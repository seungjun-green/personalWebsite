import { NextResponse } from "next/server";
import { saveUpload, upsertGroup } from "../../../lib/writing";
import { slugify } from "../../../lib/slug";
import { getWritingAccess, isAllowedMutationOrigin } from "../../../lib/writing-auth";
import {
  hasValidWritingImageSignature,
  isSupportedWritingImage,
  MAX_WRITING_IMAGE_BYTES,
  writingImageExtension,
} from "../../../lib/writing-images";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const access = await getWritingAccess();
  if (!access.allowed) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  if (!isAllowedMutationOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  if (access.mode !== "local") {
    return NextResponse.json(
      { error: "Images are published with the post in GitHub mode." },
      { status: 400 },
    );
  }

  const form = await request.formData();
  const file = form.get("file");
  const groupName = String(form.get("groupName") || "").trim();
  const groupId = String(form.get("groupId") || "").trim() || undefined;
  const title = String(form.get("title") || "").trim();
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Image file is required." }, { status: 400 });
  }
  if (!isSupportedWritingImage(file.type, file.name)) {
    return NextResponse.json({ error: "Use a PNG, JPEG, GIF, or WebP image." }, { status: 400 });
  }
  if (file.size > MAX_WRITING_IMAGE_BYTES) {
    return NextResponse.json({ error: "Images must be less than 4 MB." }, { status: 413 });
  }
  if (!groupName || !title) {
    return NextResponse.json({ error: "Set a group and title before adding images." }, { status: 400 });
  }

  try {
    const group = upsertGroup(groupName, groupId);
    const slug = String(form.get("slug") || slugify(title));
    const ext = writingImageExtension(file.name, file.type);
    const filename = `${Date.now()}-${slugify(file.name.replace(/\.[^.]+$/, "") || "image")}${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    if (!hasValidWritingImageSignature(bytes, file.type)) {
      return NextResponse.json(
        { error: "Image contents do not match its file type." },
        { status: 400 },
      );
    }
    const url = saveUpload({ groupId: group.id, slug, filename, bytes });

    return NextResponse.json({ url, alt: file.name, slug, groupId: group.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed." },
      { status: 400 },
    );
  }
}
