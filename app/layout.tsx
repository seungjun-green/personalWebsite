import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Seungjun Lee — ML Researcher",
  description:
    "ML researcher working on LLM safety and NLP alignment. Personal site, research, and selected projects.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
