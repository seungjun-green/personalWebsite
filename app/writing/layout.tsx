import { getWritingTree, isWritingEditorEnabled } from "../lib/writing";
import WritingSidebar from "./WritingSidebar";

export const dynamic = "force-dynamic";

export default function WritingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tree = getWritingTree();
  const editor = isWritingEditorEnabled();

  return (
    <div className="mx-auto grid max-w-[1100px] grid-cols-1 gap-10 px-8 py-12 md:grid-cols-[240px_minmax(0,1fr)] max-sm:px-5">
      <WritingSidebar tree={tree} editor={editor} />
      <div>{children}</div>
    </div>
  );
}
