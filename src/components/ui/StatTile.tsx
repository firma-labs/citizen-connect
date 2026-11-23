import Link from "next/link";

export type Tone = "sky" | "mint" | "violet" | "rose" | "peach";

// Full class strings per tone so Tailwind can see them.
const TONES: Record<Tone, { box: string; hover: string; value: string; label: string }> = {
  sky: { box: "bg-sky-50", hover: "hover:bg-sky-100", value: "text-sky-700", label: "text-sky-700" },
  mint: { box: "bg-mint-50", hover: "hover:bg-mint-100", value: "text-mint-700", label: "text-mint-700" },
  violet: { box: "bg-indigo-50", hover: "hover:bg-indigo-100", value: "text-indigo-800", label: "text-indigo-800" },
  rose: { box: "bg-red-50", hover: "hover:bg-red-200/50", value: "text-red-600", label: "text-red-700" },
  peach: { box: "bg-marigold-50", hover: "hover:bg-marigold-200/50", value: "text-marigold-700", label: "text-marigold-700" },
};

/** Figure tile (Material 3 filled card): a flat pastel surface, big number, short label. */
export function StatTile({ tone, value, label, sub, href }: { tone: Tone; value: string; label: string; sub?: string; href?: string }) {
  const t = TONES[tone];
  const body = (
    <>
      <span className={`block text-[2rem] font-bold leading-none tracking-tight ${t.value}`}>{value}</span>
      <span className={`mt-2 block text-[0.88rem] font-semibold leading-snug ${t.label}`}>{label}</span>
      {sub && <span className={`mt-0.5 block text-[0.8rem] leading-snug opacity-80 ${t.label}`}>{sub}</span>}
    </>
  );
  const cls = `block rounded-[var(--radius-panel)] p-4 ${t.box}`;
  return href ? (
    <Link href={href} className={`${cls} ${t.hover} transition-colors`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
