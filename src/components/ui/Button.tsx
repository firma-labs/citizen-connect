import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

type Variant = "primary" | "secondary" | "quiet" | "danger";
type Size = "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-indigo-700 text-white hover:bg-indigo-800 active:bg-indigo-900 disabled:bg-rule-strong disabled:text-white",
  secondary: "bg-surface text-indigo-800 ring-2 ring-inset ring-indigo-700 hover:bg-indigo-50 active:bg-indigo-100 disabled:text-ink-3 disabled:ring-rule",
  quiet: "bg-transparent text-indigo-800 underline-offset-4 hover:bg-indigo-50 active:bg-indigo-100 disabled:text-ink-3",
  danger: "bg-surface text-red-600 ring-2 ring-inset ring-red-600 hover:bg-red-50 active:bg-red-50 disabled:opacity-50",
};
const SIZES: Record<Size, string> = {
  md: "min-h-12 px-4 text-[1rem]",
  lg: "min-h-14 px-5 text-[1.06rem]",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", block = false) {
  return `inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] font-semibold leading-tight transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${block ? "w-full" : ""}`;
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
