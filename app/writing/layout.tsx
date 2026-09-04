import { getGithubWritingSnapshot } from "../lib/github-writing";
import { getWritingTree } from "../lib/writing";
import { getWritingAccess } from "../lib/writing-auth";
import WritingSidebar from "./WritingSidebar";

export const dynamic = "force-dynamic";

export default async function WritingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await getWritingAccess();
  const snapshot =
    access.allowed && access.mode === "github"
      ? await getGithubWritingSnapshot()
      : null;
  const tree = snapshot?.tree ?? getWritingTree();

  return (
    <div className="mx-auto grid max-w-[1100px] grid-cols-1 gap-10 px-8 py-12 md:grid-cols-[240px_minmax(0,1fr)] max-sm:px-5">
      <WritingSidebar
        tree={tree}
        editor={access.allowed}
        mode={access.mode}
        headSha={snapshot?.headSha}
      />
      <div>{children}</div>
    </div>
  );
}
