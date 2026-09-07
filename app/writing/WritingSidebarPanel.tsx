"use client";

import { useWritingAdmin } from "./WritingAdminContext";
import WritingAuthControl from "./WritingAuthControl";
import WritingSidebar from "./WritingSidebar";

export default function WritingSidebarPanel() {
  const admin = useWritingAdmin();
  const sidebarKey = `${admin.mode}:${admin.headSha ?? "public"}:${admin.editor}`;

  return (
    <div className="relative">
      <div className="mb-6 md:absolute md:-top-10 md:mb-0">
        <WritingAuthControl />
      </div>
      <WritingSidebar
        key={sidebarKey}
        tree={admin.tree}
        editor={admin.editor}
        mode={admin.mode}
        headSha={admin.headSha}
      />
    </div>
  );
}
