import Link from "next/link";

export type Tone = "sky" | "mint" | "violet" | "rose" | "peach";

// Full class strings per tone so Tailwind can see them.
const TONES: Record<Tone, { box: string; edge: string; value: string; label: string; dot: string }> = {
  sky: { box: "from-sky-50 via-sky-50/40 to-white", edge: "border-sky-200", value: "text-sky-700", label: "text-sky-700", dot: "bg-sky-100" },
  mint: { box: "from-mint-50 via-mint-50/40 to-white", edge: "border-mint-200", value: "text-mint-700", label: "text-mint-700", dot: "bg-mint-100" },
  violet: { box: "from-indigo-50 via-indigo-50/40 to-white", edge: "border-indigo-200", value: "text-indigo-800", label: "text-indigo-800", dot: "bg-indigo-100" },
  rose: { box: "from-red-50 via-red-50/40 to-white", edge: "border-red-200", value: "text-red-600", label: "text-red-700", dot: "bg-red-200/60" },
  peach: { box: "from-marigold-50 via-marigold-50/40 to-white", edge: "border-marigold-200", value: "text-marigold-700", label: "text-marigold-700", dot: "bg-marigold-200/60" },
};

/** Pastel figure tile: tinted gradient, coloured left edge, soft corner circle. */
export function StatTile({ tone, value, label, sub, href }: { tone: Tone; value: string; label: string; sub?: string; href?: string }) {
  const t = TONES[tone];
  const body = (
    <>
      <span aria-hidden className={`pointer-events-none absolute -bottom-8 -right-8 h-24 w-24 rounded-full ${t.dot}`} />
      <span className={`relative block text-[2rem] font-bold leading-none tracking-tight ${t.value}`}>{value}</span>
      <span className={`relative mt-2 block text-[0.88rem] font-semibold leading-snug ${t.label}`}>{label}</span>
      {sub && <span className={`relative mt-0.5 block text-[0.8rem] leading-snug opacity-80 ${t.label}`}>{sub}</span>}
    </>
  );
  const cls = `relative block overflow-hidden rounded-[var(--radius-panel)] border border-l-4 bg-gradient-to-br p-4 shadow-[0_10px_28px_-22px_rgb(28_31_51/0.35)] ${t.box} ${t.edge}`;
  return href ? (
    <Link href={href} className={`${cls} transition-transform active:scale-[0.98]`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
