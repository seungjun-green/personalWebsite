import { notFound, redirect } from "next/navigation";
import { getGithubWritingSnapshot } from "../../../../lib/github-writing";
import { getPost, getWritingTree } from "../../../../lib/writing";
import { getWritingAccess } from "../../../../lib/writing-auth";
import WritingEditor from "../../../WritingEditor";

export default async function EditWritingPage({
  params,
}: {
  params: Promise<{ group: string; slug: string }>;
}) {
  const access = await getWritingAccess();
  if (!access.allowed) redirect("/writing/admin");
  const { group, slug } = await params;
  const snapshot =
    access.mode === "github" ? await getGithubWritingSnapshot() : null;
  const post = snapshot
    ? snapshot.posts.find(
        (candidate) => candidate.groupId === group && candidate.slug === slug,
      )
    : getPost(group, slug);
  if (!post) notFound();
  const tree = snapshot?.tree ?? getWritingTree();

  return (
    <div>
      <h1 className="text-[1.8rem] font-semibold tracking-[-0.03em] text-[var(--ink)]">
        Edit post
      </h1>
      <div className="mt-8">
        <WritingEditor
          groups={tree.groups}
          post={post}
          mode={access.mode}
          headSha={snapshot?.headSha}
        />
      </div>
    </div>
  );
}
