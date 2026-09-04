import Link from "next/link";
import { notFound } from "next/navigation";
import { getPost, isWritingEditorEnabled, listPosts } from "../../../lib/writing";
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
  const post = getPost(group, slug);
  if (!post) notFound();
  const editor = isWritingEditorEnabled();

  return (
    <article>
      <p className="text-[0.74rem] font-semibold uppercase tracking-[0.16em] text-[var(--cardinal)]">
        {post.groupName}
      </p>
      <h1 className="mt-2 text-[2.1rem] font-semibold leading-tight tracking-[-0.03em] text-[var(--ink)]">
        {post.title}
      </h1>
      {post.date && (
        <p className="mt-2 text-[0.88rem] text-[var(--ink-4)]">{post.date}</p>
      )}
      {editor && (
        <p className="mt-4">
          <Link href={`/writing/${post.groupId}/${post.slug}/edit`}>Edit</Link>
        </p>
      )}
      <div className="mt-8">
        <WritingMarkdown>{post.body}</WritingMarkdown>
      </div>
    </article>
  );
}
