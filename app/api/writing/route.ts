import { NextResponse } from "next/server";
import {
  deletePost,
  getWritingTree,
  savePost,
  updateWritingOrganization,
  type WritingOrganizationGroup,
} from "../../lib/writing";
import { slugify } from "../../lib/slug";
import { getWritingAccess, isAllowedMutationOrigin } from "../../lib/writing-auth";
import {
  GithubConflictError,
  deleteGithubPost,
  getGithubWritingSnapshot,
  updateGithubOrganization,
} from "../../lib/github-writing";

export const runtime = "nodejs";

function forbidden() {
  return NextResponse.json({ error: "Sign in with the authorized GitHub account." }, { status: 401 });
}

export async function GET() {
  const access = await getWritingAccess();
  if (access.allowed && access.mode === "github") {
    const snapshot = await getGithubWritingSnapshot();
    return NextResponse.json({
      editor: true,
      mode: "github",
      headSha: snapshot.headSha,
      tree: snapshot.tree,
    });
  }
  return NextResponse.json({
    editor: access.allowed,
    mode: access.mode,
    tree: getWritingTree(),
  });
}

export async function POST(request: Request) {
  const access = await getWritingAccess();
  if (!access.allowed) return forbidden();
  if (!isAllowedMutationOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  if (access.mode !== "local") {
    return NextResponse.json({ error: "Use the GitHub publishing endpoint." }, { status: 400 });
  }

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
  const access = await getWritingAccess();
  if (!access.allowed) return forbidden();
  if (!isAllowedMutationOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const body = (await request.json()) as {
    groups?: WritingOrganizationGroup[];
    expectedHead?: string;
  };
  if (!Array.isArray(body.groups)) {
    return NextResponse.json({ error: "Groups are required." }, { status: 400 });
  }

  try {
    if (access.mode === "github") {
      if (!body.expectedHead) {
        return NextResponse.json({ error: "Repository version is required." }, { status: 400 });
      }
      const commit = await updateGithubOrganization(body.expectedHead, body.groups);
      return NextResponse.json({ commit });
    }
    const tree = updateWritingOrganization(body.groups);
    return NextResponse.json({ tree });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed." },
      { status: error instanceof GithubConflictError ? 409 : 400 },
    );
  }
}

export async function DELETE(request: Request) {
  const access = await getWritingAccess();
  if (!access.allowed) return forbidden();
  if (!isAllowedMutationOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const body = (await request.json()) as {
    groupId?: string;
    slug?: string;
    expectedHead?: string;
  };
  if (!body.groupId || !body.slug) {
    return NextResponse.json({ error: "Post is required." }, { status: 400 });
  }
  try {
    if (access.mode === "github") {
      if (!body.expectedHead) {
        return NextResponse.json({ error: "Repository version is required." }, { status: 400 });
      }
      const commit = await deleteGithubPost(
        body.expectedHead,
        body.groupId,
        body.slug,
      );
      return NextResponse.json({ commit });
    }
    return NextResponse.json({ tree: deletePost(body.groupId, body.slug) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Delete failed." },
      { status: error instanceof GithubConflictError ? 409 : 400 },
    );
  }
}
