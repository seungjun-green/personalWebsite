import { getGithubWritingSnapshot } from "../lib/github-writing";
import { getWritingTree } from "../lib/writing";
import { getWritingAccess } from "../lib/writing-auth";
import WritingAuthControl from "./WritingAuthControl";
import WritingChrome from "./WritingChrome";
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
    <WritingChrome
      sidebar={
        <div className="relative">
          <div className="mb-6 md:absolute md:-top-10 md:mb-0">
            <WritingAuthControl />
          </div>
          <WritingSidebar
            tree={tree}
            editor={access.allowed}
            mode={access.mode}
            headSha={snapshot?.headSha}
          />
        </div>
      }
    >
      {children}
    </WritingChrome>
  );
}
