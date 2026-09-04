import { NextResponse } from "next/server";
import {
  getWritingTree,
  isWritingEditorEnabled,
  savePost,
  updateWritingOrganization,
  type WritingOrganizationGroup,
} from "../../lib/writing";
import { slugify } from "../../lib/slug";

export const runtime = "nodejs";

function forbidden() {
  return NextResponse.json({ error: "Editor is local-only." }, { status: 403 });
}

export async function GET() {
  return NextResponse.json({
    editor: isWritingEditorEnabled(),
    tree: getWritingTree(),
  });
}

export async function POST(request: Request) {
  if (!isWritingEditorEnabled()) return forbidden();

  const body = (await request.json()) as {
    title?: string;
    groupName?: string;
    groupId?: string;
    slug?: string;
    content?: string;
    date?: string;
    previousGroupId?: string;
    previousSlug?: string;
  };

  const title = body.title?.trim();
  const groupName = body.groupName?.trim();
  if (!title || !groupName) {
    return NextResponse.json({ error: "Title and group are required." }, { status: 400 });
  }

  const groupId = body.groupId?.trim() || slugify(groupName);
  const slug = body.slug?.trim() || slugify(title);
  const saved = savePost({
    title,
    groupId,
    groupName,
    slug,
    body: body.content ?? "",
    date: body.date,
    previousGroupId: body.previousGroupId,
    previousSlug: body.previousSlug,
  });

  return NextResponse.json({ post: saved, tree: getWritingTree() });
}

export async function PATCH(request: Request) {
  if (!isWritingEditorEnabled()) return forbidden();

  const body = (await request.json()) as {
    groups?: WritingOrganizationGroup[];
  };
  if (!Array.isArray(body.groups)) {
    return NextResponse.json({ error: "Groups are required." }, { status: 400 });
  }

  try {
    const tree = updateWritingOrganization(body.groups);
    return NextResponse.json({ tree });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed." },
      { status: 400 },
    );
  }
}
