import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

type Variant = "primary" | "secondary" | "quiet" | "danger";
type Size = "md" | "lg";

// Crisp rectangles (GOV.UK / UX4G habit): the primary button has a violet
// "pressed edge" that sinks when tapped; secondary and danger are bordered.
const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-ink text-white shadow-[0_3px_0_0_var(--color-indigo-700)] hover:bg-[#2c3050] active:translate-y-[2px] active:shadow-[0_1px_0_0_var(--color-indigo-700)] disabled:translate-y-0 disabled:bg-rule-strong disabled:text-white disabled:shadow-none",
  secondary:
    "border-[1.5px] border-indigo-600 bg-surface text-indigo-800 shadow-[0_2px_0_0_var(--color-indigo-200)] hover:bg-indigo-50 active:translate-y-[1px] active:shadow-none disabled:border-rule-strong disabled:bg-surface disabled:text-ink-3 disabled:shadow-none",
  quiet: "bg-transparent text-indigo-800 underline-offset-4 hover:bg-indigo-50 hover:underline active:bg-indigo-100 disabled:text-ink-3",
  danger:
    "border-[1.5px] border-red-600 bg-surface text-red-600 shadow-[0_2px_0_0_var(--color-red-200)] hover:bg-red-50 active:translate-y-[1px] active:shadow-none disabled:opacity-50",
};
const SIZES: Record<Size, string> = {
  md: "min-h-12 px-5 text-[0.98rem]",
  lg: "min-h-14 px-6 text-[1.04rem]",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", block = false) {
  return `inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] font-semibold leading-tight transition-[background-color,box-shadow,transform] duration-100 disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${block ? "w-full" : ""}`;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  block,
  icon,
  href,
  className = "",
  ...rest
}: {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  block?: boolean;
  icon?: IconName;
  href?: string;
  className?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">) {
  const cls = `${buttonClass(variant, size, block)} ${className}`;
  const inner = (
    <>
      {icon && <Icon name={icon} size={size === "lg" ? 22 : 20} />}
      <span>{children}</span>
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} {...rest}>
      {inner}
    </button>
  );
}
