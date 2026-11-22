import type { Metadata, Viewport } from "next";
import { Noto_Sans, Noto_Sans_Devanagari } from "next/font/google";
import { AppRuntime } from "@/components/AppRuntime";
import "./globals.css";

const noto = Noto_Sans({ variable: "--font-noto", subsets: ["latin"], weight: ["400", "600", "700", "800"] });
const deva = Noto_Sans_Devanagari({ variable: "--font-deva", subsets: ["devanagari"], weight: ["400", "600", "700", "800"] });

export const metadata: Metadata = {
  title: { default: "जनता दरबार · Citizen Connect", template: "%s · Janata Darbar" },
  description: "Janata Darbar intake: scan applications, issue tokens, verify and route.",
  applicationName: "Janata Darbar",
  appleWebApp: { capable: true, title: "Janata Darbar", statusBarStyle: "default" },
  icons: { icon: "/pwa-icon/192", apple: "/pwa-icon/180" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#17632f",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="mr" className={`${noto.variable} ${deva.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <AppRuntime />
        {children}
      </body>
    </html>
  );
}
