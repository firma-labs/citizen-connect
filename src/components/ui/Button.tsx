import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

type Variant = "primary" | "secondary" | "quiet" | "danger";
type Size = "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-ink text-white shadow-[0_6px_16px_-8px_rgb(28_31_51/0.55)] hover:bg-[#2c3050] active:bg-black disabled:bg-rule-strong disabled:text-white disabled:shadow-none",
  secondary: "bg-indigo-50 text-indigo-800 hover:bg-indigo-100 active:bg-indigo-200 disabled:bg-paper disabled:text-ink-3",
  quiet: "bg-transparent text-indigo-800 hover:bg-indigo-50 active:bg-indigo-100 disabled:text-ink-3",
  danger: "bg-red-50 text-red-600 hover:bg-red-200/60 active:bg-red-200 disabled:opacity-50",
};
const SIZES: Record<Size, string> = {
  md: "min-h-12 px-5 text-[0.98rem]",
  lg: "min-h-14 px-6 text-[1.04rem]",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", block = false) {
  return `inline-flex items-center justify-center gap-2 rounded-full font-semibold leading-tight transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${block ? "w-full" : ""}`;
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
