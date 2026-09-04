"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SiteHeader() {
  const pathname = usePathname();
  const onWriting = pathname.startsWith("/writing");

  return (
    <header className="border-b border-[var(--line)] bg-white">
      <div className="mx-auto flex max-w-[1100px] items-center justify-between px-8 py-3.5 text-[0.74rem] uppercase tracking-[0.18em] max-sm:px-5">
        <Link href="/" className="site-brand font-semibold text-[var(--ink)]">
          Seungjun Lee
        </Link>
        <nav aria-label="Site" className="flex gap-6">
          <Link
            href="/"
            aria-current={!onWriting ? "page" : undefined}
            className={`site-nav-link ${!onWriting ? "is-active" : ""}`}
          >
            Portfolio
          </Link>
          <Link
            href="/writing"
            aria-current={onWriting ? "page" : undefined}
            className={`site-nav-link ${onWriting ? "is-active" : ""}`}
          >
            Writing
          </Link>
        </nav>
      </div>
    </header>
  );
}
