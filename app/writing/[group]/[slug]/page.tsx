import { notFound } from "next/navigation";
import { getPublishedWritingPost } from "../../../lib/published-writing";
import { getPost } from "../../../lib/writing";
import WritingPostAdminActions from "../../WritingPostAdminActions";
import WritingPostView from "../../WritingPostView";

// New post URLs must be checked on every request, including before redeployment.
export const dynamic = "force-dynamic";

export default async function WritingPostPage({
  params,
}: {
  params: Promise<{ group: string; slug: string }>;
}) {
  const { group, slug } = await params;
  let post = getPost(group, slug);
  let imageSources: Record<string, string> | undefined;
  if (!post) {
    // Only posts missing from the deployed snapshot need a GitHub lookup.
    const published = await getPublishedWritingPost(group, slug);
    post = published?.post ?? null;
    imageSources = published?.imageSources;
  }
  if (!post) notFound();

  return (
    <WritingPostView
      post={post}
      imageSources={imageSources}
      actions={<WritingPostAdminActions post={post} />}
    />
  );
}
