import Link from "next/link";
import { getGithubWritingSnapshot } from "../lib/github-writing";
import { getWritingTree } from "../lib/writing";
import { getWritingAccess } from "../lib/writing-auth";

export default async function WritingIndexPage() {
  const access = await getWritingAccess();
  const snapshot =
    access.allowed && access.mode === "github"
      ? await getGithubWritingSnapshot()
      : null;
  const tree = snapshot?.tree ?? getWritingTree();
  const editor = access.allowed;
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
