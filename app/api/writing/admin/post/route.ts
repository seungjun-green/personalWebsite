import { NextResponse } from "next/server";
import {
  GithubConflictError,
  saveGithubPost,
  type GithubPostInput,
} from "../../../../lib/github-writing";
import {
  getWritingAccess,
  isAllowedMutationOrigin,
} from "../../../../lib/writing-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

export async function POST(request: Request) {
  const access = await getWritingAccess();
  if (!access.allowed || access.mode !== "github") {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  if (!isAllowedMutationOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  try {
    const form = await request.formData();
    const rawPayload = form.get("payload");
    if (typeof rawPayload !== "string") {
      return NextResponse.json({ error: "Post data is required." }, { status: 400 });
    }
    const payload = JSON.parse(rawPayload) as GithubPostInput;
    const files = form
      .getAll("images")
      .filter((entry): entry is File => entry instanceof File);
    const totalBytes = files.reduce((total, file) => total + file.size, 0);
    if (totalBytes > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "Images must total less than 4 MB." },
        { status: 413 },
      );
    }
    const images = await Promise.all(
      files.map(async (file) => ({
        filename: file.name,
        type: file.type,
        bytes: Buffer.from(await file.arrayBuffer()),
      })),
    );
    for (const file of images) {
      if (!IMAGE_TYPES.has(file.type) || !/^[a-zA-Z0-9._-]+$/.test(file.filename)) {
        return NextResponse.json({ error: "Invalid image file." }, { status: 400 });
      }
      if (!hasValidImageSignature(file.bytes, file.type)) {
        return NextResponse.json(
          { error: "Image contents do not match its file type." },
          { status: 400 },
        );
      }
    }

    const result = await saveGithubPost(
      payload,
      images.map(({ filename, bytes }) => ({ filename, bytes })),
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Publish failed." },
      { status: error instanceof GithubConflictError ? 409 : 400 },
    );
  }
}

function hasValidImageSignature(bytes: Buffer, type: string) {
  if (type === "image/png") {
    return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  if (type === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (type === "image/gif") {
    const signature = bytes.subarray(0, 6).toString("ascii");
    return signature === "GIF87a" || signature === "GIF89a";
  }
  if (type === "image/webp") {
    return (
      bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }
  return false;
}
