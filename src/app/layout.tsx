import type { Metadata, Viewport } from "next";
import { Noto_Sans, Poppins } from "next/font/google";
import { AppRuntime } from "@/components/AppRuntime";
import { Toaster } from "@/components/ui/Toast";
import "./globals.css";

// Noto Sans (UX4G's typeface): body text and form fields — Google's reference
// Devanagari, the most legible for long Marathi and Hindi text.
// Poppins (Indian Type Foundry): headings, token numbers and big figures —
// the app's geometric personality.
const noto = Noto_Sans({ variable: "--font-noto", subsets: ["devanagari", "latin"], weight: ["400", "500", "600", "700"] });
const poppins = Poppins({ variable: "--font-poppins", subsets: ["devanagari", "latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: { default: "जनता दरबार · Janata Darbar", template: "%s · Janata Darbar" },
  description: "Janata Darbar intake: scan applications, issue tokens, check and route.",
  applicationName: "Janata Darbar",
  appleWebApp: { capable: true, title: "Janata Darbar", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/pwa-icon/32", sizes: "32x32", type: "image/png" },
      { url: "/pwa-icon/192", sizes: "192x192", type: "image/png" },
    ],
    // iPhone home-screen icon (Safari and Chrome on iOS use this, not the manifest).
    apple: [{ url: "/pwa-icon/180", sizes: "180x180", type: "image/png" }],
  },
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
    <html lang="mr" className={`${noto.variable} ${poppins.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <AppRuntime />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
