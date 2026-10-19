import type { Metadata, Viewport } from "next";
import { Source_Serif_4, Public_Sans, Sometype_Mono } from "next/font/google";
import "./globals.css";

const display = Source_Serif_4({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-display", display: "swap" });
const body = Public_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-body", display: "swap" });
const mono = Sometype_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "OpenTally",
  description: "Mini-grid grants in Nigeria wait on four private tallies. OpenTally releases each connection's grant on one public rule anyone can re-sum.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#FBFAF6" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
