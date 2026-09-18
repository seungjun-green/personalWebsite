import "server-only";

import { markdownImageUrls } from "./markdown-images";
import { isWritingSegment } from "./slug";
import { parseFrontMatter, type WritingGroup, type WritingPost } from "./writing";

const repositoryApi = "https://api.github.com/repos/seungjun-green/personalWebsite";

async function githubRead(resource: string, accept: string) {
  const response = await fetch(`${repositoryApi}/${resource}`, {
    headers: {
      Accept: accept,
      Authorization: `Bearer ${process.env.GITHUB_CONTENT_PAT}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    // A missing file must be checked again after publication, not cached as a 404.
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(`Unable to load published writing (${response.status}).`);
  }
  return response;
}

export async function readPublishedWritingFile(path: string, ref: string) {
  if (!/^[a-f0-9]{40}$/.test(ref)) throw new Error("Invalid writing revision.");
  if (
    !/^(content\/writing\/|public\/writing\/)/.test(path) ||
    path.split("/").some((part) => part === "." || part === "..") ||
    path.includes("\\")
  ) {
    throw new Error("Invalid writing path.");
  }
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return githubRead(`contents/${encodedPath}?ref=${ref}`, "application/vnd.github.raw+json");
}

export async function getPublishedWritingPost(groupId: string, slug: string): Promise<{
  post: WritingPost;
  imageSources: Record<string, string>;
} | null> {
  if (!isWritingSegment(groupId) || !isWritingSegment(slug)) return null;
  if (process.env.NODE_ENV !== "production" || !process.env.GITHUB_CONTENT_PAT) return null;

  // Read the post, group name, and images from one committed version of main.
  const head = await githubRead("git/ref/heads/main", "application/vnd.github+json");
  if (!head.ok) throw new Error("Unable to load the writing repository.");
  const { object } = (await head.json()) as { object: { sha: string } };
  const response = await readPublishedWritingFile(
    `content/writing/posts/${groupId}/${slug}.md`, object.sha,
  );
  if (response.status === 404) return null;

  const { data, body } = parseFrontMatter(await response.text());
  const groupsResponse = await readPublishedWritingFile("content/writing/groups.json", object.sha);
  const groups: WritingGroup[] = groupsResponse.ok
    ? ((await groupsResponse.json()) as { groups?: WritingGroup[] }).groups ?? []
    : [];
  const imageSources: Record<string, string> = {};
  for (const url of markdownImageUrls(body)) {
    const match = url.match(/^\/writing\/([a-z0-9][a-z0-9-]*)\/([a-z0-9][a-z0-9-]*)\/([a-zA-Z0-9._-]+\.(?:png|jpe?g|gif|webp))$/i);
    if (!match) continue;
    const query = new URLSearchParams({
      group: match[1], slug: match[2], filename: match[3], ref: object.sha,
    });
    imageSources[url] = `/api/writing/image?${query}`;
  }

  return {
    post: {
      title: data.title || slug,
      groupId,
      groupName: groups.find((group) => group.id === groupId)?.name || groupId,
      slug,
      date: data.date || "",
      href: `/writing/${groupId}/${slug}`,
      body: body.trim(),
    },
    imageSources,
  };
}
