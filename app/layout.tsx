import type { Metadata } from "next";
import "katex/dist/katex.min.css";
import "./globals.css";
import SiteHeader from "./components/SiteHeader";

export const metadata: Metadata = {
  title: "Seungjun Lee — ML Researcher",
  description:
    "ML researcher working on LLM safety and NLP alignment. Personal site, research, and selected projects.",
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }],
    apple: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div className="ribbon" aria-hidden="true" />
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
