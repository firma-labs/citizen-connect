// Tokens are generated on the device so the counter never waits on the network
// or the model (PRD §5). Format: <VENUE>-<DDMM>-<5 chars>, e.g. TH-2211-7KQ4X.
// Alphabet drops 0/1/I/L/O/U so a token read aloud or handwritten is unambiguous;
// 30^5 ≈ 24M combinations per venue per day, and the server rejects duplicates.

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

export function generateToken(venue: string, now = new Date()): string {
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  const rand = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
  return `${venue}-${dd}${mm}-${rand}`;
}

export const TOKEN_RE = /^[A-Z]{2}-\d{4}-[2-9A-HJKMNP-TV-Z]{5}$/;

export function normaliseToken(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "").replace(/[–—_]/g, "-");
}

const DEVANAGARI_DIGITS = "०१२३४५६७८९";

/** Devanagari digits → ASCII, strip separators and +91/0 prefix (mobile field only, PRD §7.5). */
export function normaliseMobile(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const ascii = raw.replace(/[०-९]/g, (d) => String(DEVANAGARI_DIGITS.indexOf(d)));
  let digits = ascii.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits || null;
}

export const isValidMobile = (m: string | null | undefined) => !!m && /^[6-9]\d{9}$/.test(m);
