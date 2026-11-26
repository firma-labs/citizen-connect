import type { StoryArt as Art } from "@/lib/stories";

/**
 * Small flat illustrations for the sample stories: the issue, not a person.
 * Drawn in the app's pastel palette; decorative (the card text says the same).
 */
export function StoryArt({ art, size = 56 }: { art: Art; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="shrink-0 rounded-[14px]">
      {art === "water" && (
        <>
          <rect width="64" height="64" fill="var(--color-sky-100)" />
          <path d="M14 22h22a6 6 0 0 1 6 6v4h-8v-2H14z" fill="var(--color-sky-500)" />
          <rect x="10" y="20" width="6" height="12" rx="2" fill="var(--color-sky-700)" />
          <rect x="33" y="31" width="10" height="4" rx="1.5" fill="var(--color-sky-700)" />
          <path d="M38 40c0 0-5 6-5 9.5a5 5 0 0 0 10 0C43 46 38 40 38 40z" fill="var(--color-sky-500)" />
          <path d="M10 56h44" stroke="var(--color-sky-200)" strokeWidth="3" strokeLinecap="round" />
        </>
      )}
      {art === "crop" && (
        <>
          <rect width="64" height="64" fill="var(--color-mint-50)" />
          <ellipse cx="40" cy="15" rx="12" ry="6" fill="var(--color-sky-200)" />
          <ellipse cx="31" cy="17" rx="8" ry="5" fill="var(--color-sky-200)" />
          <path d="M28 25l-2 5M36 25l-2 5M44 25l-2 5" stroke="var(--color-sky-500)" strokeWidth="2" strokeLinecap="round" />
          {[16, 26, 36, 46].map((x) => (
            <g key={x}>
              <path d={`M${x} 56V38`} stroke="var(--color-mint-700)" strokeWidth="2" strokeLinecap="round" />
              <path d={`M${x} 42c-4-2-5-6-5-8 3 1 5 3 5 8zM${x} 46c4-2 5-6 5-8-3 1-5 3-5 8z`} fill="var(--color-mint-500)" />
            </g>
          ))}
          <path d="M8 57h48" stroke="var(--color-marigold-200)" strokeWidth="3" strokeLinecap="round" />
        </>
      )}
      {art === "pension" && (
        <>
          <rect width="64" height="64" fill="var(--color-marigold-50)" />
          <rect x="14" y="12" width="26" height="34" rx="3" fill="#fff" stroke="var(--color-marigold-200)" strokeWidth="2" />
          <path d="M19 20h16M19 26h16M19 32h10" stroke="var(--color-marigold-200)" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="42" cy="44" r="11" fill="var(--color-marigold-500)" />
          <path d="M37.5 38.5h9M37.5 42h9M40 38.5c4.5 0 4.5 7-1 7l6 5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </>
      )}
      {art === "wildlife" && (
        <>
          <rect width="64" height="64" fill="var(--color-indigo-50)" />
          <path d="M14 46l7-18 7 18z" fill="var(--color-mint-500)" />
          <path d="M44 48l6-15 6 15z" fill="var(--color-mint-500)" />
          <rect x="20" y="46" width="2" height="6" fill="var(--color-mint-700)" />
          <rect x="49" y="48" width="2" height="5" fill="var(--color-mint-700)" />
          <g fill="var(--color-marigold-700)">
            <ellipse cx="34" cy="40" rx="6" ry="5" />
            <circle cx="27" cy="32" r="2.6" />
            <circle cx="32" cy="29" r="2.6" />
            <circle cx="38" cy="29" r="2.6" />
            <circle cx="42" cy="33" r="2.6" />
          </g>
        </>
      )}
    </svg>
  );
}

/** Initials avatar for a sample story: a soft gradient, never a photo. */
export function InitialsAvatar({ name, size = 40 }: { name: string; size?: number }) {
  // First grapheme, so Devanagari conjuncts (सु, शां) stay whole.
  const seg = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;
  const first = seg ? ([...seg.segment(name.trim())][0]?.segment ?? "") : name.trim().charAt(0);
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full font-bold text-ink shadow-[inset_0_0_0_2px_rgb(255_255_255/0.7)]"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: "conic-gradient(from 200deg, #ffd7c2, #f6c1e0, #d6ccfd, #b4d6fb, #a9e2c6, #ffd7c2)",
      }}
    >
      {first}
    </span>
  );
}

export type StepArtKind = "scan" | "read" | "token" | "route" | "track";

/** Illustrations for the "How it works" steps, in the same style as StoryArt. Decorative. */
export function StepArt({ kind, size = 56 }: { kind: StepArtKind; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="shrink-0 rounded-[16px]">
      {kind === "scan" && (
        <>
          <rect width="64" height="64" fill="var(--color-sky-100)" />
          {/* the letter, slightly turned, inside the scanner's corner marks */}
          <g transform="rotate(-6 32 33)">
            <rect x="19" y="14" width="26" height="36" rx="2.5" fill="#fff" stroke="var(--color-sky-200)" strokeWidth="1.5" />
            <path d="M24 22h16M24 27.5h16M24 33h12M24 38.5h14" stroke="var(--color-sky-500)" strokeWidth="2.2" strokeLinecap="round" />
          </g>
          <path
            d="M12 20v-6a2 2 0 0 1 2-2h6M44 12h6a2 2 0 0 1 2 2v6M52 44v6a2 2 0 0 1-2 2h-6M20 52h-6a2 2 0 0 1-2-2v-6"
            stroke="var(--color-sky-700)"
            strokeWidth="2.6"
            strokeLinecap="round"
            fill="none"
          />
        </>
      )}
      {kind === "read" && (
        <>
          <rect width="64" height="64" fill="var(--color-marigold-50)" />
          {/* the letter being read, with the AI sparkle and a Devanagari letter */}
          <rect x="13" y="14" width="26" height="36" rx="2.5" fill="#fff" stroke="var(--color-marigold-200)" strokeWidth="1.5" />
          <path d="M18 22h16M18 27.5h16M18 33h11M18 38.5h14M18 44h9" stroke="var(--color-marigold-200)" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="44" cy="40" r="11" fill="var(--color-marigold-500)" />
          <text x="44" y="45" textAnchor="middle" fontSize="15" fontWeight="700" fill="#fff" style={{ fontFamily: "inherit" }}>
            अ
          </text>
          <path d="M47 11l1.6 4.4L53 17l-4.4 1.6L47 23l-1.6-4.4L41 17l4.4-1.6z" fill="var(--color-indigo-600)" />
          <path d="M55 24l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" fill="var(--color-indigo-600)" />
        </>
      )}
      {kind === "route" && (
        <>
          <rect width="64" height="64" fill="var(--color-sky-100)" />
          {/* the department's office, with the response deadline */}
          <path d="M9 24l21-11 21 11z" fill="var(--color-sky-700)" />
          <rect x="11" y="24" width="38" height="3" fill="var(--color-sky-700)" />
          {[14, 22, 30, 38].map((x) => (
            <rect key={x} x={x} y="29" width="5" height="16" rx="1" fill="var(--color-sky-500)" />
          ))}
          <rect x="9" y="46" width="42" height="4" rx="1" fill="var(--color-sky-700)" />
          <circle cx="47" cy="46" r="10" fill="#fff" stroke="var(--color-marigold-500)" strokeWidth="2.4" />
          <path d="M47 40.5V46l3.5 2.5" stroke="var(--color-marigold-700)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </>
      )}
      {kind === "token" && (
        <>
          <rect width="64" height="64" fill="var(--color-indigo-100)" />
          <rect x="20" y="9" width="24" height="46" rx="5" fill="#fff" stroke="var(--color-indigo-800)" strokeWidth="2.2" />
          <path d="M29 13.5h6" stroke="var(--color-indigo-200)" strokeWidth="2" strokeLinecap="round" />
          {/* the WhatsApp message with the token */}
          <path d="M14 26a4 4 0 0 1 4-4h22a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4H24l-5 4v-4h-1a4 4 0 0 1-4-4z" fill="var(--color-indigo-600)" />
          <path d="M20 28h18M20 33h11" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="32" cy="49" r="2" fill="var(--color-indigo-200)" />
        </>
      )}
      {kind === "track" && (
        <>
          <rect width="64" height="64" fill="var(--color-mint-100)" />
          {/* kept clear of the top-left corner, where the step number sits */}
          <path d="M26 20v27" stroke="var(--color-mint-200)" strokeWidth="3" strokeLinecap="round" />
          <path d="M26 20v14" stroke="var(--color-mint-500)" strokeWidth="3" strokeLinecap="round" />
          {[20, 34].map((y) => (
            <g key={y}>
              <circle cx="26" cy={y} r="6" fill="var(--color-mint-500)" />
              <path d={`M23.3 ${y}l1.9 1.9 3.6-3.8`} stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </g>
          ))}
          <circle cx="26" cy="48" r="5.5" fill="#fff" stroke="var(--color-mint-500)" strokeWidth="2.2" />
          <path d="M37 20h15M37 34h12M37 48h14" stroke="var(--color-mint-700)" strokeWidth="2.6" strokeLinecap="round" opacity="0.55" />
        </>
      )}
    </svg>
  );
}
