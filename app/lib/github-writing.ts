import "server-only";

import { Octokit } from "@octokit/rest";
import {
  buildWritingTree,
  parseFrontMatter,
  removePostFromGroupOrder,
  serializePost,
  type WritingGroup,
  type WritingOrganizationGroup,
  type WritingPost,
  type WritingPostMeta,
  type WritingTree,
} from "./writing";
import { slugify } from "./slug";

type RepositoryConfig = {
  owner: string;
  repo: string;
  branch: string;
};

type TreeFile = {
  path: string;
  sha: string;
};

type RepositorySnapshot = {
  headSha: string;
  treeSha: string;
  files: TreeFile[];
  groups: WritingGroup[];
  posts: WritingPost[];
  tree: WritingTree;
};

export type CommitChange =
  | { path: string; content: string | Buffer }
  | { path: string; existingSha: string }
  | { path: string; delete: true };

export class GithubConflictError extends Error {
  constructor() {
    super("The repository changed while you were editing. Refresh and try again.");
  }
}

function config(): RepositoryConfig {
  const owner = process.env.GITHUB_REPOSITORY_OWNER;
  const repo = process.env.GITHUB_REPOSITORY_NAME;
  const branch = process.env.GITHUB_CONTENT_BRANCH || "main";
  if (!owner || !repo) throw new Error("GitHub repository is not configured.");
  return { owner, repo, branch };
}

function client() {
  const auth = process.env.GITHUB_CONTENT_PAT;
  if (!auth) throw new Error("GitHub publishing token is not configured.");
  return new Octokit({ auth });
}

function assertSegment(value: string, label: string) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(value)) {
    throw new Error(`Invalid ${label}.`);
  }
}

function assertRepoPath(repoPath: string) {
  if (
    repoPath.startsWith("/") ||
    repoPath.includes("..") ||
    repoPath.includes("\\") ||
    !/^(content\/writing|public\/writing)\//.test(repoPath)
  ) {
    throw new Error("Invalid writing path.");
  }
}

async function readBlob(octokit: Octokit, repo: RepositoryConfig, sha: string) {
  const response = await octokit.rest.git.getBlob({
    owner: repo.owner,
    repo: repo.repo,
    file_sha: sha,
  });
  return Buffer.from(response.data.content.replace(/\n/g, ""), "base64").toString("utf8");
}

export async function getGithubWritingSnapshot(
  requestedRef?: string,
): Promise<RepositorySnapshot> {
  const repo = config();
  const octokit = client();
  const ref = await octokit.rest.git.getRef({
    owner: repo.owner,
    repo: repo.repo,
    ref: `heads/${repo.branch}`,
  });
  const headSha = ref.data.object.sha;
  const commitSha = requestedRef || headSha;
  const commit = await octokit.rest.git.getCommit({
    owner: repo.owner,
    repo: repo.repo,
    commit_sha: commitSha,
  });
  const treeSha = commit.data.tree.sha;
  const response = await octokit.rest.git.getTree({
    owner: repo.owner,
    repo: repo.repo,
    tree_sha: treeSha,
    recursive: "true",
  });
  if (response.data.truncated) throw new Error("Repository tree is too large to edit.");

  const files = response.data.tree
    .filter((entry): entry is typeof entry & { path: string; sha: string } =>
      Boolean(entry.type === "blob" && entry.path && entry.sha),
    )
    .map((entry) => ({ path: entry.path, sha: entry.sha }));

  const groupsFile = files.find((file) => file.path === "content/writing/groups.json");
  const groups = groupsFile
    ? ((JSON.parse(await readBlob(octokit, repo, groupsFile.sha)) as {
        groups?: WritingGroup[];
      }).groups ?? [])
    : [];
  const groupNames = new Map(groups.map((group) => [group.id, group.name]));
  const postFiles = files.filter((file) =>
    /^content\/writing\/posts\/[^/]+\/[^/]+\.md$/.test(file.path),
  );
  const posts = await Promise.all(
    postFiles.map(async (file): Promise<WritingPost> => {
      const [, , , groupId, filename] = file.path.split("/");
      const slug = filename.slice(0, -3);
      const raw = await readBlob(octokit, repo, file.sha);
      const { data, body } = parseFrontMatter(raw);
      return {
        title: data.title || slug,
        groupId,
        groupName: groupNames.get(groupId) || groupId,
        slug,
        date: data.date || "",
        href: `/writing/${groupId}/${slug}`,
        body: body.trim(),
      };
    }),
  );
  posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return {
    headSha,
    treeSha,
    files,
    groups,
    posts,
    tree: buildWritingTree(groups, posts),
  };
}

export async function commitGithubChanges(
  expectedHead: string,
  message: string,
  changes: CommitChange[],
) {
  const repo = config();
  const octokit = client();
  const ref = await octokit.rest.git.getRef({
    owner: repo.owner,
    repo: repo.repo,
    ref: `heads/${repo.branch}`,
  });
  if (ref.data.object.sha !== expectedHead) throw new GithubConflictError();

  const baseCommit = await octokit.rest.git.getCommit({
    owner: repo.owner,
    repo: repo.repo,
    commit_sha: expectedHead,
  });
  const entries: Array<{
    path: string;
    mode: "100644";
    type: "blob";
    sha: string | null;
  }> = [];

  for (const change of changes) {
    assertRepoPath(change.path);
    if ("delete" in change) {
      entries.push({ path: change.path, mode: "100644", type: "blob", sha: null });
    } else if ("existingSha" in change) {
      entries.push({
        path: change.path,
        mode: "100644",
        type: "blob",
        sha: change.existingSha,
      });
    } else {
      const binary = Buffer.isBuffer(change.content);
      const content = binary
        ? Buffer.from(change.content).toString("base64")
        : String(change.content);
      const blob = await octokit.rest.git.createBlob({
        owner: repo.owner,
        repo: repo.repo,
        content,
        encoding: binary ? "base64" : "utf-8",
      });
      entries.push({ path: change.path, mode: "100644", type: "blob", sha: blob.data.sha });
    }
  }

  const tree = await octokit.rest.git.createTree({
    owner: repo.owner,
    repo: repo.repo,
    base_tree: baseCommit.data.tree.sha,
    tree: entries,
  });
  const operationId = crypto.randomUUID();
  const commit = await octokit.rest.git.createCommit({
    owner: repo.owner,
    repo: repo.repo,
    message: `${message}\n\nWriting-Operation: ${operationId}`,
    tree: tree.data.sha,
    parents: [expectedHead],
  });
  try {
    await octokit.rest.git.updateRef({
      owner: repo.owner,
      repo: repo.repo,
      ref: `heads/${repo.branch}`,
      sha: commit.data.sha,
      force: false,
    });
  } catch (error) {
    const latest = await octokit.rest.git.getRef({
      owner: repo.owner,
      repo: repo.repo,
      ref: `heads/${repo.branch}`,
    });
    if (latest.data.object.sha !== commit.data.sha) throw error;
  }

  return {
    sha: commit.data.sha,
    url: `https://github.com/${repo.owner}/${repo.repo}/commit/${commit.data.sha}`,
  };
}

function serializeGroups(groups: WritingGroup[]) {
  return JSON.stringify({ groups }, null, 2) + "\n";
}

export async function updateGithubOrganization(
  expectedHead: string,
  requestedGroups: WritingOrganizationGroup[],
) {
  const snapshot = await getGithubWritingSnapshot(expectedHead);
  const currentById = new Map(snapshot.tree.groups.map((group) => [group.id, group]));
  const requestedIds = requestedGroups.map((group) => group.id);
  if (
    requestedIds.length !== snapshot.groups.length ||
    new Set(requestedIds).size !== requestedIds.length ||
    requestedIds.some((id) => !currentById.has(id))
  ) {
    throw new Error("The group list changed. Refresh and try again.");
  }

  const groups = requestedGroups.map((requested) => {
    const current = currentById.get(requested.id)!;
    const name = requested.name.trim();
    if (!name) throw new Error("Group names cannot be empty.");
    const valid = new Set(current.posts.map((post) => post.slug));
    const postOrder = requested.postOrder.filter(
      (slug, index, all) => valid.has(slug) && all.indexOf(slug) === index,
    );
    for (const post of current.posts) {
      if (!postOrder.includes(post.slug)) postOrder.push(post.slug);
    }
    return { id: requested.id, name, postOrder };
  });

  return commitGithubChanges(expectedHead, "Update writing organization", [
    { path: "content/writing/groups.json", content: serializeGroups(groups) },
  ]);
}

export type GithubPostInput = {
  expectedHead: string;
  title: string;
  groupName: string;
  groupId?: string;
  slug?: string;
  content: string;
  date?: string;
  previousGroupId?: string;
  previousSlug?: string;
};

export async function saveGithubPost(
  input: GithubPostInput,
  images: { filename: string; bytes: Buffer }[],
) {
  const snapshot = await getGithubWritingSnapshot(input.expectedHead);
  const title = input.title.trim();
  const groupName = input.groupName.trim();
  if (!title || !groupName) throw new Error("Title and group are required.");
  const knownGroup = snapshot.groups.find(
    (group) => group.id === input.groupId || group.name === groupName,
  );
  const groupId = knownGroup?.id || slugify(groupName);
  const slug = input.previousSlug || input.slug || slugify(title);
  assertSegment(groupId, "group");
  assertSegment(slug, "post slug");

  const treeById = new Map(snapshot.tree.groups.map((group) => [group.id, group]));
  const groups = snapshot.groups.map((group) => ({
    ...group,
    postOrder: [
      ...(group.postOrder ??
        treeById.get(group.id)?.posts.map((post) => post.slug) ??
        []),
    ],
  }));
  let group = groups.find((item) => item.id === groupId);
  if (!group) {
    group = { id: groupId, name: groupName, postOrder: [] };
    groups.push(group);
  }
  group.name = groupName;

  if (input.previousGroupId && input.previousSlug) {
    const previousGroup = groups.find((item) => item.id === input.previousGroupId);
    if (previousGroup) {
      previousGroup.postOrder = (previousGroup.postOrder ?? []).filter(
        (item) => item !== input.previousSlug,
      );
    }
  }
  if (!group.postOrder?.includes(slug)) group.postOrder?.push(slug);

  const oldPrefix =
    input.previousGroupId && input.previousSlug
      ? `public/writing/${input.previousGroupId}/${input.previousSlug}/`
      : null;
  const newPrefix = `public/writing/${groupId}/${slug}/`;
  let content = input.content;
  const changes: CommitChange[] = [];
  if (oldPrefix && oldPrefix !== newPrefix) {
    content = content.replaceAll(
      `/${oldPrefix.replace(/^public\//, "")}`,
      `/${newPrefix.replace(/^public\//, "")}`,
    );
    for (const file of snapshot.files.filter((item) => item.path.startsWith(oldPrefix))) {
      changes.push({
        path: newPrefix + file.path.slice(oldPrefix.length),
        existingSha: file.sha,
      });
      changes.push({ path: file.path, delete: true });
    }
    changes.push({
      path: `content/writing/posts/${input.previousGroupId}/${input.previousSlug}.md`,
      delete: true,
    });
  }

  const date = input.date || new Date().toISOString().slice(0, 10);
  changes.push({
    path: "content/writing/groups.json",
    content: serializeGroups(groups),
  });
  changes.push({
    path: `content/writing/posts/${groupId}/${slug}.md`,
    content: serializePost({
      title,
      groupId,
      date,
      body: content.endsWith("\n") ? content : `${content}\n`,
    }),
  });
  for (const image of images) {
    if (!/^[a-zA-Z0-9._-]+$/.test(image.filename)) {
      throw new Error("Invalid image filename.");
    }
    changes.push({ path: `${newPrefix}${image.filename}`, content: image.bytes });
  }

  const commit = await commitGithubChanges(
    input.expectedHead,
    input.previousSlug ? `Update writing: ${title}` : `Add writing: ${title}`,
    changes,
  );
  const post: WritingPostMeta = {
    title,
    groupId,
    groupName,
    slug,
    date,
    href: `/writing/${groupId}/${slug}`,
  };
  return { ...commit, post };
}

export async function deleteGithubPost(
  expectedHead: string,
  groupId: string,
  slug: string,
) {
  assertSegment(groupId, "group");
  assertSegment(slug, "post slug");
  const snapshot = await getGithubWritingSnapshot(expectedHead);
  if (!snapshot.posts.some((post) => post.groupId === groupId && post.slug === slug)) {
    throw new Error("Post not found.");
  }
  const groups = removePostFromGroupOrder(snapshot.groups, groupId, slug);
  const prefix = `public/writing/${groupId}/${slug}/`;
  const changes: CommitChange[] = [
    { path: "content/writing/groups.json", content: serializeGroups(groups) },
    { path: `content/writing/posts/${groupId}/${slug}.md`, delete: true },
    ...snapshot.files
      .filter((file) => file.path.startsWith(prefix))
      .map((file): CommitChange => ({ path: file.path, delete: true })),
  ];
  return commitGithubChanges(expectedHead, `Delete writing: ${groupId}/${slug}`, changes);
}
