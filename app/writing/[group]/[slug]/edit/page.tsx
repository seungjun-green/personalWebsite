import { notFound, redirect } from "next/navigation";
import { getPost, getWritingTree, isWritingEditorEnabled } from "../../../../lib/writing";
import WritingEditor from "../../../WritingEditor";

export default async function EditWritingPage({
  params,
}: {
  params: Promise<{ group: string; slug: string }>;
}) {
  if (!isWritingEditorEnabled()) redirect("/writing");
  const { group, slug } = await params;
  const post = getPost(group, slug);
  if (!post) notFound();
  const tree = getWritingTree();

  return (
    <div>
      <h1 className="text-[1.8rem] font-semibold tracking-[-0.03em] text-[var(--ink)]">
        Edit post
      </h1>
      <div className="mt-8">
        <WritingEditor groups={tree.groups} post={post} />
      </div>
    </div>
  );
}
