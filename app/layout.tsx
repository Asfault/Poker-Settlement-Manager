import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pokeresh",
  applicationName: "Pokeresh",
  description:
    "Track buy-ins, settle balances, and export a clean WhatsApp-friendly poker night summary.",
  appleWebApp: {
    capable: true,
    title: "Pokeresh",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a3320",
  width: "device-width",
  initialScale: 1,
  // Required for env(safe-area-inset-*) to report anything but 0. Without it
  // the black-translucent status bar tucks content under the Dynamic Island.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
