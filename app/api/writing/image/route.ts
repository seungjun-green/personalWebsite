import { readPublishedWritingFile } from "../../../lib/published-writing";
import { isWritingSegment } from "../../../lib/slug";

const imageTypes: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  gif: "image/gif", webp: "image/webp",
};

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const group = query.get("group") ?? "";
  const slug = query.get("slug") ?? "";
  const filename = query.get("filename") ?? "";
  const ref = query.get("ref") ?? "";
  const contentType = imageTypes[filename.split(".").at(-1)?.toLowerCase() ?? ""];
  if (
    !isWritingSegment(group) || !isWritingSegment(slug) ||
    !/^[a-zA-Z0-9._-]+$/.test(filename) || !contentType ||
    !/^[a-f0-9]{40}$/.test(ref) || !process.env.GITHUB_CONTENT_PAT
  ) {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const response = await readPublishedWritingFile(`public/writing/${group}/${slug}/${filename}`, ref);
    if (response.status === 404) {
      return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
    }
    return new Response(response.body, {
      headers: {
        "Content-Type": contentType,
        "X-Content-Type-Options": "nosniff",
        // The commit SHA makes this URL immutable, including across deployments.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Image temporarily unavailable", {
      status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "5" },
    });
  }
}
