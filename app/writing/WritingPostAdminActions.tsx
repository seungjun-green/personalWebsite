"use client";

import Link from "next/link";
import type { WritingPost } from "../lib/writing";
import DeletePostButton from "./DeletePostButton";
import { useWritingAdmin } from "./WritingAdminContext";

export default function WritingPostAdminActions({ post }: { post: WritingPost }) {
  const admin = useWritingAdmin();
  if (!admin.editor) return null;

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`${post.href}/edit`}
        className="writing-secondary-action border border-[var(--line-strong)] px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.12em] transition-colors hover:border-[var(--cardinal)]"
      >
        Edit post
      </Link>
      <DeletePostButton
        groupId={post.groupId}
        slug={post.slug}
        title={post.title}
        mode={admin.mode}
        headSha={admin.headSha}
      />
    </div>
  );
}
