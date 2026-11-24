"use client";

import NextLink from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import { navType } from "@/lib/client/transitions";

/**
 * next/link that tags the navigation with its direction (forward, back, tab),
 * so <Screen> can animate it. Use it for every in-app link.
 */
export default function Link(props: ComponentProps<typeof NextLink>) {
  const from = usePathname();
  const to = typeof props.href === "string" ? props.href : (props.href.pathname ?? from);
  return <NextLink transitionTypes={[navType(from, to)]} {...props} />;
}
