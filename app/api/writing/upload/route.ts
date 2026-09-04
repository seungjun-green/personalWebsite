import { NextResponse } from "next/server";
import { saveUpload, upsertGroup } from "../../../lib/writing";
import { slugify } from "../../../lib/slug";
import { getWritingAccess, isAllowedMutationOrigin } from "../../../lib/writing-auth";

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
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image files can be dropped." }, { status: 400 });
  }
  if (!groupName || !title) {
    return NextResponse.json({ error: "Set a group and title before adding images." }, { status: 400 });
  }

  const group = upsertGroup(groupName, groupId);
  const slug = String(form.get("slug") || slugify(title));
  const ext = pathExt(file.name, file.type);
  const filename = `${Date.now()}-${slugify(file.name.replace(/\.[^.]+$/, "") || "image")}${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const url = saveUpload({ groupId: group.id, slug, filename, bytes });

  return NextResponse.json({ url, alt: file.name, slug, groupId: group.id });
}

function pathExt(name: string, type: string) {
  const fromName = name.match(/\.(png|jpe?g|gif|webp|svg)$/i)?.[0];
  if (fromName) return fromName.toLowerCase();
  if (type === "image/jpeg") return ".jpg";
  if (type === "image/webp") return ".webp";
  if (type === "image/gif") return ".gif";
  if (type === "image/svg+xml") return ".svg";
  return ".png";
}
