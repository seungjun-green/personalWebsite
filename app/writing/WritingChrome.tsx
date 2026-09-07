"use client";

import { usePathname } from "next/navigation";

export default function WritingChrome({
  sidebar,
  children,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const composing =
    pathname === "/writing/new" || /\/writing\/[^/]+\/[^/]+\/edit$/.test(pathname);

  if (composing) {
    return (
      <div className="mx-auto max-w-[740px] px-8 py-10 max-sm:px-5">{children}</div>
    );
  }

  return (
    <div className="mx-auto grid max-w-[1100px] grid-cols-1 gap-10 px-8 py-12 md:grid-cols-[240px_minmax(0,1fr)] max-sm:px-5">
      {sidebar}
      <div>{children}</div>
    </div>
  );
}
