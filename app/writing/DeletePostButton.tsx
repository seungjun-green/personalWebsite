"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeletePostButton({
  groupId,
  slug,
  title,
  mode = "local",
  headSha,
}: {
  groupId: string;
  slug: string;
  title: string;
  mode?: "local" | "github";
  headSha?: string;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function onDelete() {
    if (!window.confirm(`Delete “${title}” and all of its images?`)) return;
    setDeleting(true);
    try {
      const response = await fetch("/api/writing", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId,
          slug,
          expectedHead: mode === "github" ? headSha : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Delete failed.");
      router.push("/writing");
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Delete failed.");
      setDeleting(false);
    }
  }

  return (
    <button
      type="button"
      disabled={deleting}
      onClick={() => void onDelete()}
      className="cursor-pointer border border-[var(--line-strong)] px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[var(--ink-2)] transition-colors hover:border-[var(--cardinal)] hover:text-[var(--cardinal)] disabled:opacity-60"
    >
      {deleting ? "Deleting…" : "Delete"}
    </button>
  );
}
