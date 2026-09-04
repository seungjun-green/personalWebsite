import Link from "next/link";
import { getWritingTree, isWritingEditorEnabled } from "../lib/writing";

export default function WritingIndexPage() {
  const tree = getWritingTree();
  const editor = isWritingEditorEnabled();
  const first = tree.groups.find((g) => g.posts.length > 0)?.posts[0];

  if (first) {
    return (
      <div>
        <p className="text-[0.9rem] leading-7 text-[var(--ink-2)]">
          Select a post from the sidebar
          {first ? (
            <>
              , or open{" "}
              <Link href={first.href}>{first.title}</Link>.
            </>
          ) : null}
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-[2rem] font-semibold tracking-[-0.03em] text-[var(--ink)]">
        Writing
      </h1>
      <p className="mt-4 max-w-[560px] text-[1.02rem] leading-7 text-[var(--ink-2)]">
        Paper summaries, Kaggle write-ups, and notes.
        {editor
          ? " Use New post in the sidebar to add a group, title, text, and images, then save. After that, commit and push from the terminal."
          : ""}
      </p>
      {editor && (
        <p className="mt-6">
          <Link href="/writing/new">New post</Link>
        </p>
      )}
    </div>
  );
}
