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

// Default engine when AI_READER isn't set:
//   AWS credentials present → Claude Opus 5 on Bedrock, Mumbai (ap-south-1), India
//     cross-Region profile (PRD §7.2 production default; data stays in ap-south-1/2)
//   else ANTHROPIC_API_KEY → Claude Opus 5 on the Claude API (mock letters only)
//   else → mock
const BEDROCK_MODEL = process.env.BEDROCK_MODEL || "in.anthropic.claude-opus-5";
const hasAwsCreds = !!(
  process.env.AWS_BEARER_TOKEN_BEDROCK ||
  process.env.AWS_ACCESS_KEY_ID ||
  process.env.AWS_PROFILE
);
const DEFAULT_SPEC = hasAwsCreds
  ? `bedrock:${BEDROCK_MODEL}`
  : process.env.ANTHROPIC_API_KEY
    ? "anthropic:claude-opus-5"
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
