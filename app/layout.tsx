import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "YardCart — Online ordering & dispatch for landscape supply yards",
    template: "%s | YardCart",
  },
  description:
    "Take bulk mulch, topsoil, and firewood orders online 24/7. Zone-based delivery pricing, a dispatch board your drivers actually use, and no per-order fees.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
