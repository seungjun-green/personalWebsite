import Link from "next/link";
import { notFound } from "next/navigation";
import { getGithubWritingSnapshot } from "../../../lib/github-writing";
import { getPost, listPosts } from "../../../lib/writing";
import { getWritingAccess } from "../../../lib/writing-auth";
import WritingMarkdown from "../../WritingMarkdown";

export function generateStaticParams() {
  return listPosts().map((post) => ({
    group: post.groupId,
    slug: post.slug,
  }));
}

export default async function WritingPostPage({
  params,
}: {
  params: Promise<{ group: string; slug: string }>;
}) {
  const { group, slug } = await params;
  const access = await getWritingAccess();
  let post = getPost(group, slug);
  if (!post && access.allowed && access.mode === "github") {
    const snapshot = await getGithubWritingSnapshot();
    post =
      snapshot.posts.find(
        (candidate) => candidate.groupId === group && candidate.slug === slug,
      ) ?? null;
  }
  if (!post) notFound();
  const editor = access.allowed;

  return (
    <article>
      <p className="text-[0.74rem] font-semibold uppercase tracking-[0.16em] text-[var(--cardinal)]">
        {post.groupName}
      </p>
      <h1 className="mt-2 text-[2.1rem] font-semibold leading-tight tracking-[-0.03em] text-[var(--ink)]">
        {post.title}
      </h1>
      <div className="mt-4 flex min-h-8 items-center justify-between gap-4 border-b border-[var(--line)] pb-5">
        {post.date ? (
          <time className="text-[0.82rem] text-[var(--ink-4)]">{post.date}</time>
        ) : (
          <span />
        )}
        {editor && (
          <Link
            href={`/writing/${post.groupId}/${post.slug}/edit`}
            className="writing-secondary-action border border-[var(--line-strong)] px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.12em] transition-colors hover:border-[var(--cardinal)]"
          >
            Edit post
          </Link>
        )}
      </div>
      <div className="mt-7">
        <WritingMarkdown>{post.body}</WritingMarkdown>
      </div>
    </article>
  );
}
