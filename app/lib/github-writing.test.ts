import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRef: vi.fn(),
  getCommit: vi.fn(),
  createBlob: vi.fn(),
  createTree: vi.fn(),
  createCommit: vi.fn(),
  updateRef: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@octokit/rest", () => ({
  Octokit: class {
    rest = {
      git: {
        getRef: mocks.getRef,
        getCommit: mocks.getCommit,
        createBlob: mocks.createBlob,
        createTree: mocks.createTree,
        createCommit: mocks.createCommit,
        updateRef: mocks.updateRef,
      },
    };
  },
}));

import {
  GithubConflictError,
  commitGithubChanges,
} from "./github-writing";

describe("atomic GitHub commits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GITHUB_CONTENT_PAT = "test-token";
  });

  it("creates one tree and advances main once", async () => {
    mocks.getRef.mockResolvedValue({ data: { object: { sha: "base" } } });
    mocks.getCommit.mockResolvedValue({ data: { tree: { sha: "old-tree" } } });
    mocks.createBlob
      .mockResolvedValueOnce({ data: { sha: "groups-blob" } })
      .mockResolvedValueOnce({ data: { sha: "post-blob" } });
    mocks.createTree.mockResolvedValue({ data: { sha: "new-tree" } });
    mocks.createCommit.mockResolvedValue({ data: { sha: "new-commit" } });
    mocks.updateRef.mockResolvedValue({});

    const result = await commitGithubChanges("base", "Update writing", [
      { path: "content/writing/groups.json", content: "{}\n" },
      { path: "content/writing/posts/notes/post.md", content: "# Post\n" },
      { path: "public/writing/notes/post/old.png", delete: true },
    ]);

    expect(result.sha).toBe("new-commit");
    expect(mocks.createTree).toHaveBeenCalledWith(
      expect.objectContaining({
        base_tree: "old-tree",
        tree: [
          expect.objectContaining({ path: "content/writing/groups.json", sha: "groups-blob" }),
          expect.objectContaining({ path: "content/writing/posts/notes/post.md", sha: "post-blob" }),
          expect.objectContaining({ path: "public/writing/notes/post/old.png", sha: null }),
        ],
      }),
    );
    expect(mocks.createCommit).toHaveBeenCalledTimes(1);
    expect(mocks.updateRef).toHaveBeenCalledWith(
      expect.objectContaining({ ref: "heads/main", sha: "new-commit", force: false }),
    );
  });

  it("rejects a stale repository head before creating objects", async () => {
    mocks.getRef.mockResolvedValue({ data: { object: { sha: "newer" } } });
    await expect(
      commitGithubChanges("base", "Update writing", [
        { path: "content/writing/groups.json", content: "{}" },
      ]),
    ).rejects.toBeInstanceOf(GithubConflictError);
    expect(mocks.createBlob).not.toHaveBeenCalled();
    expect(mocks.createTree).not.toHaveBeenCalled();
  });

  it("rejects paths outside writing content", async () => {
    mocks.getRef.mockResolvedValue({ data: { object: { sha: "base" } } });
    mocks.getCommit.mockResolvedValue({ data: { tree: { sha: "old-tree" } } });
    await expect(
      commitGithubChanges("base", "Bad update", [
        { path: "../package.json", content: "{}" },
      ]),
    ).rejects.toThrow("Invalid writing path.");
    expect(mocks.createBlob).not.toHaveBeenCalled();
  });
});
