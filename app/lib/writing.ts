import fs from "fs";
import path from "path";

export type WritingGroup = {
  id: string;
  name: string;
  postOrder?: string[];
};

export type WritingPostMeta = {
  title: string;
  groupId: string;
  groupName: string;
  slug: string;
  date: string;
  href: string;
};

export type WritingPost = WritingPostMeta & {
  body: string;
};

export type WritingTree = {
  groups: (WritingGroup & { posts: WritingPostMeta[] })[];
};

export type WritingOrganizationGroup = {
  id: string;
  name: string;
  postOrder: string[];
};

const ROOT = process.cwd();
const GROUPS_PATH = path.join(ROOT, "content/writing/groups.json");
const POSTS_DIR = path.join(ROOT, "content/writing/posts");

function ensureDirs() {
  fs.mkdirSync(path.dirname(GROUPS_PATH), { recursive: true });
  fs.mkdirSync(POSTS_DIR, { recursive: true });
}

export function isWritingEditorEnabled() {
  return process.env.NODE_ENV === "development";
}

export function readGroups(): WritingGroup[] {
  ensureDirs();
  if (!fs.existsSync(GROUPS_PATH)) return [];
  const parsed = JSON.parse(fs.readFileSync(GROUPS_PATH, "utf8")) as {
    groups?: WritingGroup[];
  };
  return parsed.groups ?? [];
}

export function writeGroups(groups: WritingGroup[]) {
  ensureDirs();
  fs.writeFileSync(GROUPS_PATH, JSON.stringify({ groups }, null, 2) + "\n");
}

function parseFrontMatter(raw: string): { data: Record<string, string>; body: string } {
  if (!raw.startsWith("---\n")) return { data: {}, body: raw };
  const end = raw.indexOf("\n---\n", 4);
  if (end === -1) return { data: {}, body: raw };
  const matter = raw.slice(4, end);
  const body = raw.slice(end + 5);
  const data: Record<string, string> = {};
  for (const line of matter.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    data[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return { data, body };
}

function serializePost(post: { title: string; groupId: string; date: string; body: string }) {
  return `---\ntitle: ${post.title}\ngroup: ${post.groupId}\ndate: ${post.date}\n---\n${post.body.replace(/^\n/, "")}`;
}

export function listPosts(): WritingPostMeta[] {
  const groups = readGroups();
  const groupNames = new Map(groups.map((g) => [g.id, g.name]));
  if (!fs.existsSync(POSTS_DIR)) return [];

  const posts: WritingPostMeta[] = [];
  for (const groupId of fs.readdirSync(POSTS_DIR)) {
    const dir = path.join(POSTS_DIR, groupId);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".md")) continue;
      const slug = file.slice(0, -3);
      const raw = fs.readFileSync(path.join(dir, file), "utf8");
      const { data } = parseFrontMatter(raw);
      posts.push({
        title: data.title || slug,
        groupId,
        groupName: groupNames.get(groupId) || groupId,
        slug,
        date: data.date || "",
        href: `/writing/${groupId}/${slug}`,
      });
    }
  }

  return posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export function getWritingTree(): WritingTree {
  const groups = readGroups();
  const posts = listPosts();
  return {
    groups: groups.map((group) => {
      const groupPosts = posts.filter((post) => post.groupId === group.id);
      const positions = new Map(
        (group.postOrder ?? []).map((slug, index) => [slug, index]),
      );
      groupPosts.sort((a, b) => {
        const aPosition = positions.get(a.slug);
        const bPosition = positions.get(b.slug);
        if (aPosition === undefined && bPosition === undefined) return 0;
        if (aPosition === undefined) return 1;
        if (bPosition === undefined) return -1;
        return aPosition - bPosition;
      });
      return { ...group, posts: groupPosts };
    }),
  };
}

export function updateWritingOrganization(
  requestedGroups: WritingOrganizationGroup[],
): WritingTree {
  const currentTree = getWritingTree();
  const currentById = new Map(currentTree.groups.map((group) => [group.id, group]));
  const requestedIds = requestedGroups.map((group) => group.id);

  if (
    requestedIds.length !== currentTree.groups.length ||
    new Set(requestedIds).size !== requestedIds.length ||
    requestedIds.some((id) => !currentById.has(id))
  ) {
    throw new Error("The group list changed. Refresh and try again.");
  }

  const groups = requestedGroups.map((requested) => {
    const current = currentById.get(requested.id)!;
    const name = requested.name.trim();
    if (!name) throw new Error("Group names cannot be empty.");

    const validSlugs = new Set(current.posts.map((post) => post.slug));
    const orderedSlugs = requested.postOrder.filter(
      (slug, index, all) => validSlugs.has(slug) && all.indexOf(slug) === index,
    );
    for (const post of current.posts) {
      if (!orderedSlugs.includes(post.slug)) orderedSlugs.push(post.slug);
    }

    return { id: current.id, name, postOrder: orderedSlugs };
  });

  writeGroups(groups);
  return getWritingTree();
}

export function getPost(groupId: string, slug: string): WritingPost | null {
  const file = path.join(POSTS_DIR, groupId, `${slug}.md`);
  if (!fs.existsSync(file)) return null;
  const groups = readGroups();
  const group = groups.find((g) => g.id === groupId);
  const raw = fs.readFileSync(file, "utf8");
  const { data, body } = parseFrontMatter(raw);
  return {
    title: data.title || slug,
    groupId,
    groupName: group?.name || groupId,
    slug,
    date: data.date || "",
    href: `/writing/${groupId}/${slug}`,
    body: body.trim(),
  };
}

export function upsertGroup(name: string, id?: string): WritingGroup {
  const groups = readGroups();
  const groupId = id || name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const existing = groups.find((g) => g.id === groupId);
  if (existing) {
    if (existing.name !== name && name.trim()) {
      existing.name = name.trim();
      writeGroups(groups);
    }
    return existing;
  }
  const group = { id: groupId, name: name.trim() || groupId };
  groups.push(group);
  writeGroups(groups);
  return group;
}

export function savePost(input: {
  title: string;
  groupId: string;
  groupName?: string;
  slug: string;
  body: string;
  date?: string;
  previousGroupId?: string;
  previousSlug?: string;
}): WritingPostMeta {
  const group = upsertGroup(input.groupName || input.groupId, input.groupId);
  const date = input.date || new Date().toISOString().slice(0, 10);
  const dir = path.join(POSTS_DIR, group.id);
  fs.mkdirSync(dir, { recursive: true });

  if (
    input.previousGroupId &&
    input.previousSlug &&
    (input.previousGroupId !== group.id || input.previousSlug !== input.slug)
  ) {
    const prev = path.join(POSTS_DIR, input.previousGroupId, `${input.previousSlug}.md`);
    if (fs.existsSync(prev)) fs.unlinkSync(prev);
  }

  fs.writeFileSync(
    path.join(dir, `${input.slug}.md`),
    serializePost({
      title: input.title,
      groupId: group.id,
      date,
      body: input.body.endsWith("\n") ? input.body : `${input.body}\n`,
    }),
  );

  updatePostOrderAfterSave({
    groupId: group.id,
    slug: input.slug,
    previousGroupId: input.previousGroupId,
    previousSlug: input.previousSlug,
  });

  return {
    title: input.title,
    groupId: group.id,
    groupName: group.name,
    slug: input.slug,
    date,
    href: `/writing/${group.id}/${input.slug}`,
  };
}

function updatePostOrderAfterSave(input: {
  groupId: string;
  slug: string;
  previousGroupId?: string;
  previousSlug?: string;
}) {
  const groups = readGroups();
  let changed = false;

  for (const group of groups) {
    if (!group.postOrder) continue;

    if (group.id === input.previousGroupId && input.previousSlug) {
      const index = group.postOrder.indexOf(input.previousSlug);
      if (index !== -1) {
        group.postOrder.splice(index, 1);
        changed = true;
        if (group.id === input.groupId) {
          group.postOrder.splice(index, 0, input.slug);
          continue;
        }
      }
    }

    if (group.id === input.groupId && !group.postOrder.includes(input.slug)) {
      group.postOrder.push(input.slug);
      changed = true;
    }
  }

  if (changed) writeGroups(groups);
}

export function saveUpload(params: {
  groupId: string;
  slug: string;
  filename: string;
  bytes: Buffer;
}) {
  const safeName = params.filename.replace(/[^a-zA-Z0-9._-]/g, "-");
  const dir = path.join(ROOT, "public/writing", params.groupId, params.slug);
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, safeName);
  fs.writeFileSync(dest, params.bytes);
  return `/writing/${params.groupId}/${params.slug}/${safeName}`;
}
