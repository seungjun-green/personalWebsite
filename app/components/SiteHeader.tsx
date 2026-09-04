"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SiteHeader() {
  const pathname = usePathname();
  const onWriting = pathname.startsWith("/writing");
  const width = onWriting ? "max-w-[1100px]" : "max-w-[880px]";

  return (
    <div className="border-b border-[var(--line)]">
      <div
        className={`mx-auto flex ${width} items-center justify-between px-8 py-3 text-[0.74rem] uppercase tracking-[0.18em] max-sm:px-5`}
      >
        <Link href="/" className="font-semibold text-[var(--ink)] no-underline hover:text-[var(--cardinal)]">
          Seungjun Lee
        </Link>
        <nav aria-label="Site" className="flex gap-5">
          <Link
            href="/"
            className={
              onWriting
                ? "text-[var(--ink-3)] no-underline hover:text-[var(--cardinal)]"
                : "text-[var(--ink)] no-underline"
            }
          >
            Portfolio
          </Link>
          <Link
            href="/writing"
            className={
              onWriting
                ? "text-[var(--ink)] no-underline"
                : "text-[var(--ink-3)] no-underline hover:text-[var(--cardinal)]"
            }
          >
            Writing
          </Link>
        </nav>
      </div>
    </div>
  );
}
