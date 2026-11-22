import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import { AppRuntime } from "@/components/AppRuntime";
import "./globals.css";

// Poppins (Indian Type Foundry): geometric Latin with a matching Devanagari,
// so Marathi, Hindi and English share weight, height and rhythm.
const poppins = Poppins({ variable: "--font-poppins", subsets: ["devanagari", "latin"], weight: ["400", "500", "600", "700"] });

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
    <html lang="mr" className={`${poppins.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <AppRuntime />
        {children}
      </body>
    </html>
  );
}
