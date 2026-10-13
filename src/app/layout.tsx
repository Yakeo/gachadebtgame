import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./boot.css";
import "./combat.css";
export const metadata: Metadata = {
  title: "Gacha Debt — One Pull. All the Problems.",
  description: "An empty treasury, an unlikely student council, and a future worth fighting for. A story-driven, turn-based anime RPG with 25 campaign stages, character progression, and fair recruitment.",
  applicationName: "Gacha Debt",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#2188ed" };
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
