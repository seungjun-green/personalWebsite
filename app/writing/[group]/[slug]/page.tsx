import { notFound } from "next/navigation";
import { getPost, listPosts } from "../../../lib/writing";
import WritingPostAdminActions from "../../WritingPostAdminActions";
import WritingPostView from "../../WritingPostView";

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

  return (
    <WritingPostView
      post={post}
      actions={<WritingPostAdminActions post={post} />}
    />
  );
}
