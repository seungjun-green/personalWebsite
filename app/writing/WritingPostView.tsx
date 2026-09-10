import type { WritingPost } from "../lib/writing";
import WritingMarkdown from "./WritingMarkdown";

export default function WritingPostView({
  post,
  actions,
  imageSources,
}: {
  post: WritingPost;
  actions?: React.ReactNode;
  imageSources?: Record<string, string>;
}) {
  return (
    <article>
      <p className="text-[0.74rem] font-semibold uppercase tracking-[0.16em] text-[var(--cardinal)]">
        {post.groupName}
      </p>
      <h1 className="writing-canvas mt-2 text-[2.35rem] font-bold leading-[1.2] tracking-[-0.028em] text-[var(--ink)]">
        {post.title}
      </h1>
      <div className="mt-4 flex min-h-8 items-center justify-between gap-4 border-b border-[var(--line)] pb-5">
        {post.date ? (
          <time className="text-[0.82rem] text-[var(--ink-4)]">{post.date}</time>
        ) : (
          <span />
        )}
        {actions}
      </div>
      <div className="mt-7">
        <WritingMarkdown imageSources={imageSources}>{post.body}</WritingMarkdown>
      </div>
    </article>
  );
}
