import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Poker Settlement Manager",
  description:
    "Track buy-ins, settle balances, and export a clean WhatsApp-friendly poker night summary.",
};

export const viewport: Viewport = {
  themeColor: "#0a0f0c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
