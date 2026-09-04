import { redirect } from "next/navigation";
import { getWritingTree, isWritingEditorEnabled } from "../../lib/writing";
import WritingEditor from "../WritingEditor";

export default function NewWritingPage() {
  if (!isWritingEditorEnabled()) redirect("/writing");
  const tree = getWritingTree();
  return (
    <div>
      <h1 className="text-[1.8rem] font-semibold tracking-[-0.03em] text-[var(--ink)]">
        New post
      </h1>
      <div className="mt-8">
        <WritingEditor groups={tree.groups} />
      </div>
    </div>
  );
}
