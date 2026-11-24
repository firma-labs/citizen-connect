import Link from "@/components/ui/Link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

type Variant = "primary" | "secondary" | "quiet" | "danger";
type Size = "md" | "lg";

// Material 3 buttons: filled (the one main action), tonal (secondary actions),
// text (low-emphasis). No borders; hover and press show a state layer, and
// filled/tonal lift to elevation 1 on hover. Danger is the tonal error style.
const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-primary text-on-primary hover:bg-primary-hover hover:shadow-[var(--elevation-1)] active:shadow-none disabled:bg-ink/10 disabled:text-ink/40 disabled:shadow-none",
  secondary:
    "bg-primary-container text-on-primary-container hover:bg-primary-container-hover hover:shadow-[var(--elevation-1)] active:shadow-none disabled:bg-ink/10 disabled:text-ink/40 disabled:shadow-none",
  quiet: "bg-transparent text-primary hover:bg-primary/8 active:bg-primary/12 disabled:text-ink/40",
  danger: "bg-red-50 text-red-700 hover:bg-red-200/60 active:bg-red-200 disabled:opacity-50",
};
const SIZES: Record<Size, string> = {
  md: "min-h-12 px-5 text-[0.98rem]",
  lg: "min-h-14 px-7 text-[1.04rem]",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", block = false) {
  return `inline-flex items-center justify-center gap-2 rounded-[var(--radius-button)] font-semibold leading-tight transition-[background-color,box-shadow] duration-150 disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${block ? "w-full" : ""}`;
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
