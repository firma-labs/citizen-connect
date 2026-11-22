import "server-only";
import { ClaudeReader, ClaudeReasoner, type ClaudeProvider } from "./claude";
import { MockReader, MockReasoner } from "./mock";
import type { Reader, Reasoner } from "./types";

export type { PageImage, Reader, Reasoner } from "./types";
export { AIError } from "./claude";

// Engines are chosen by configuration, not code (PRD §7.1):
//   AI_READER   = mock | anthropic:<model> | bedrock:<model-or-inference-profile>
//   AI_REASONER = same format (defaults to AI_READER)
//   AI_EFFORT   = low | medium | high | xhigh | max (default medium)
// Examples for the pilot comparison (PRD §7.3):
//   anthropic:claude-opus-5        bedrock:in.anthropic.claude-opus-5   (production candidate)
//   anthropic:claude-sonnet-5      bedrock:in.anthropic.claude-sonnet-5
//   anthropic:claude-opus-5-5      (upper bound, global routing — mock letters only)
// A Sarvam reader would implement the same Reader interface.

// Pilot default (PRD §9.1 — mock letters only): the Claude API directly, using
// ANTHROPIC_API_KEY, with Claude Opus 5 (override with ANTHROPIC_MODEL). Without
// a key, the mock engine. Bedrock (India cross-Region profile, PRD §7.2) is the
// production path and is used only when set explicitly, e.g.
//   AI_READER=bedrock:in.anthropic.claude-opus-5  AWS_REGION=ap-south-1
const DEFAULT_SPEC = process.env.ANTHROPIC_API_KEY
  ? `anthropic:${process.env.ANTHROPIC_MODEL || "claude-opus-5"}`
  : "mock";

type Effort = "low" | "medium" | "high" | "xhigh" | "max";
const effort = (process.env.AI_EFFORT as Effort) || "medium";

function parseSpec(spec: string): { provider: "mock" } | { provider: ClaudeProvider; model: string } {
  if (spec === "mock") return { provider: "mock" };
  const [provider, ...rest] = spec.split(":");
  const model = rest.join(":");
  if ((provider === "anthropic" || provider === "bedrock") && model) return { provider, model };
  throw new Error(`Invalid AI engine spec "${spec}" — expected mock | anthropic:<model> | bedrock:<model>`);
}

export function getReader(): Reader {
  const s = parseSpec(process.env.AI_READER || DEFAULT_SPEC);
  return s.provider === "mock" ? new MockReader() : new ClaudeReader({ ...s, effort });
}

export function getReasoner(): Reasoner {
  const s = parseSpec(process.env.AI_REASONER || process.env.AI_READER || DEFAULT_SPEC);
  return s.provider === "mock" ? new MockReasoner() : new ClaudeReasoner({ ...s, effort });
}
