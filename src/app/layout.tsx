import type { Metadata, Viewport } from "next";
import { Mukta } from "next/font/google";
import { AppRuntime } from "@/components/AppRuntime";
import "./globals.css";

// Mukta (Ek Type, Mumbai): one family drawn for Devanagari and Latin, so
// Marathi, Hindi and English share weight, height and rhythm.
const mukta = Mukta({ variable: "--font-mukta", subsets: ["devanagari", "latin"], weight: ["400", "500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: { default: "जनता दरबार · Janata Darbar", template: "%s · Janata Darbar" },
  description: "Janata Darbar intake: scan applications, issue tokens, check and route.",
  applicationName: "Janata Darbar",
  appleWebApp: { capable: true, title: "Janata Darbar", statusBarStyle: "default" },
  icons: { icon: "/pwa-icon/192", apple: "/pwa-icon/180" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: browser extensions (e.g. ColorZilla, GA opt-out) add
    // attributes to <html>/<body> before React hydrates; lang is also updated on the
    // client when the user switches language. Applies to these two tags only.
    <html lang="mr" className={`${mukta.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <AppRuntime />
        {children}
      </body>
    </html>
  );
}
