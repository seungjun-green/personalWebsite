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
import {
  hasValidWritingImageSignature,
  isSupportedWritingImage,
  MAX_WRITING_IMAGE_BYTES,
} from "../../../../lib/writing-images";

export const runtime = "nodejs";
export const maxDuration = 60;

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
    if (totalBytes > MAX_WRITING_IMAGE_BYTES) {
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
      if (
        !isSupportedWritingImage(file.type, file.filename) ||
        !/^[a-zA-Z0-9._-]+$/.test(file.filename)
      ) {
        return NextResponse.json({ error: "Invalid image file." }, { status: 400 });
      }
      if (!hasValidWritingImageSignature(file.bytes, file.type)) {
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
