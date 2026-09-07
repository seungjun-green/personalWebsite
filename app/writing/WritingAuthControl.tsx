"use client";

import { signIn, signOut } from "next-auth/react";
import { useWritingAdmin } from "./WritingAdminContext";

export default function WritingAuthControl() {
  const { loaded, signedIn } = useWritingAdmin();

  return (
    <button
      type="button"
      disabled={!loaded}
      onClick={() =>
        void (signedIn
          ? signOut({ redirectTo: "/writing" })
          : signIn("github", { redirectTo: "/writing" }))
      }
      className="cursor-pointer border border-[var(--line-strong)] bg-white px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[var(--ink)] transition-colors hover:border-[var(--cardinal)] disabled:cursor-default disabled:opacity-0"
    >
      {signedIn ? "Sign out" : "Sign in"}
    </button>
  );
}
