import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Internal Tools", description: "Internal tools platform built with Devin" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
