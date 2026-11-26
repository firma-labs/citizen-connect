import Anthropic from "@anthropic-ai/sdk";
import { AnthropicBedrock } from "@anthropic-ai/bedrock-sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { partialParse } from "@anthropic-ai/sdk/_vendor/partial-json-parser/parser";
import { z } from "zod";
import { ReaderOutput, ReasonerOutput } from "@/lib/types";
import { BRIEFER_SYSTEM, READER_SYSTEM, REASONER_SYSTEM } from "./prompts";
import type { Briefer, Briefing, BriefingInput, OnProgress, PageImage, Reader, Reasoner } from "./types";

// Claude via either the Claude API (pilot, mock letters) or Amazon Bedrock
// (production). PRD §7.2: production must use the India geo cross-Region
// inference profile, e.g. `in.anthropic.claude-opus-5`, which routes only between
// ap-south-1 and ap-south-2. Inference-profile IDs go through the Bedrock
// runtime (InvokeModel) client, hence AnthropicBedrock rather than Mantle.

export type ClaudeProvider = "anthropic" | "bedrock";
type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export interface ClaudeConfig {
  provider: ClaudeProvider;
  model: string;
  effort: Effort;
}

type Client = Anthropic | AnthropicBedrock;
const clients = new Map<ClaudeProvider, Client>();
function getClient(provider: ClaudeProvider): Client {
  let c = clients.get(provider);
  if (!c) {
    c =
      provider === "bedrock"
        ? new AnthropicBedrock({ awsRegion: process.env.AWS_REGION ?? "ap-south-1" })
        : new Anthropic();
    clients.set(provider, c);
  }
  return c;
}

export class AIError extends Error {}

function checkStop(msg: { stop_reason: string | null; stop_details?: unknown }, step: string) {
  if (msg.stop_reason === "refusal") {
    throw new AIError(`${step}: model declined to process this application (refusal) — enter details manually`);
  }
  if (msg.stop_reason === "max_tokens") {
    throw new AIError(`${step}: output was cut off (max_tokens) — letter may be too long for one pass`);
  }
}

function describeError(e: unknown, step: string): never {
  if (e instanceof AIError) throw e;
  if (e instanceof Anthropic.AuthenticationError) throw new AIError(`${step}: AI credentials rejected`);
  if (e instanceof Anthropic.RateLimitError) throw new AIError(`${step}: AI rate limited — retry shortly`);
  if (e instanceof Anthropic.APIError) throw new AIError(`${step}: AI error ${e.status ?? ""} ${e.message}`);
  throw new AIError(`${step}: ${(e as Error)?.message ?? String(e)}`);
}

/**
 * Structured output streams as JSON text. Hand the partial result to
 * `onProgress` as it grows (parsed from the incomplete JSON), at most every
 * `everyMs`, so the screen can show the reading as it happens.
 */
function streamProgress(stream: { on(event: "text", fn: (delta: string, snapshot: string) => void): unknown }, onProgress?: OnProgress, everyMs = 400) {
  if (!onProgress) return;
  let last = 0;
  stream.on("text", (_delta, snapshot) => {
    const now = Date.now();
    if (now - last < everyMs) return;
    last = now;
    try {
      onProgress(partialParse(snapshot));
    } catch {
      // not parseable yet; the next chunk will be
    }
  });
}

export class ClaudeReader implements Reader {
  readonly id: string;
  constructor(private cfg: ClaudeConfig) {
    this.id = `${cfg.provider}:${cfg.model}`;
  }

  async read(pages: PageImage[], onProgress?: OnProgress): Promise<ReaderOutput> {
    const content: Anthropic.ContentBlockParam[] = [];
    for (const p of pages) {
      content.push({ type: "text", text: `Page ${p.index + 1} of ${pages.length}:` });
      content.push({ type: "image", source: { type: "base64", media_type: p.mediaType, data: p.base64 } });
    }
    content.push({
      type: "text",
      text: "Read this application. Return the transcription of every page, the fields, per-field confidence and every unclear word.",
    });

    try {
      // Streamed (same structured output), so the transcription and fields can be shown as they arrive.
      const stream = getClient(this.cfg.provider).messages.stream({
        model: this.cfg.model,
        max_tokens: 16000,
        system: READER_SYSTEM,
        messages: [{ role: "user", content }],
        output_config: { effort: this.cfg.effort, format: zodOutputFormat(ReaderOutput) },
      });
      streamProgress(stream, onProgress);
      const msg = await stream.finalMessage();
      checkStop(msg, "Reader");
      if (!msg.parsed_output) throw new AIError("Reader: response did not match the expected format");
      return msg.parsed_output;
    } catch (e) {
      describeError(e, "Reader");
    }
  }
}

export class ClaudeReasoner implements Reasoner {
  readonly id: string;
  constructor(private cfg: ClaudeConfig) {
    this.id = `${cfg.provider}:${cfg.model}`;
  }

  async reason(input: ReaderOutput, onProgress?: OnProgress): Promise<ReasonerOutput> {
    const payload = {
      language: input.language,
      fields: input.fields,
      unclear: input.unclear,
      pages: input.pages.map((p) => ({ page: p.page_number, type: p.page_type, text: p.transcription })),
    };
    try {
      const stream = getClient(this.cfg.provider).messages.stream({
        model: this.cfg.model,
        max_tokens: 8000,
        system: REASONER_SYSTEM,
        messages: [{ role: "user", content: JSON.stringify(payload) }],
        output_config: { effort: this.cfg.effort, format: zodOutputFormat(ReasonerOutput) },
      });
      streamProgress(stream, onProgress);
      const msg = await stream.finalMessage();
      checkStop(msg, "Reasoner");
      if (!msg.parsed_output) throw new AIError("Reasoner: response did not match the expected format");
      return msg.parsed_output;
    } catch (e) {
      describeError(e, "Reasoner");
    }
  }
}

const BriefingOutput = z.object({
  en: z.string().describe("English briefing, bullet points starting with •"),
  mr: z.string().describe("Marathi briefing in Devanagari, bullet points starting with •"),
});

export class ClaudeBriefer implements Briefer {
  readonly id: string;
  constructor(private cfg: ClaudeConfig) {
    this.id = `${cfg.provider}:${cfg.model}`;
  }

  async brief(input: BriefingInput): Promise<Briefing> {
    try {
      const msg = await getClient(this.cfg.provider).messages.parse({
        model: this.cfg.model,
        max_tokens: 6000,
        system: BRIEFER_SYSTEM,
        messages: [{ role: "user", content: JSON.stringify(input) }],
        output_config: { effort: this.cfg.effort, format: zodOutputFormat(BriefingOutput) },
      });
      checkStop(msg, "Briefing");
      if (!msg.parsed_output) throw new AIError("Briefing: response did not match the expected format");
      return msg.parsed_output;
    } catch (e) {
      describeError(e, "Briefing");
    }
  }
}

