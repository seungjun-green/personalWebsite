import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { getPublishedWritingPost, readPublishedWritingFile } from "./published-writing";

const revision = "a".repeat(40);
const fetchMock = vi.fn();

function head() {
  return Response.json({ object: { sha: revision } });
}

describe("published writing during deployment", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("GITHUB_CONTENT_PAT", "test-token");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("loads a committed post and its images before the deployment includes them", async () => {
    fetchMock
      .mockResolvedValueOnce(head())
      .mockResolvedValueOnce(new Response(
        "---\ntitle: New post\ndate: 2026-09-18\n---\n\nHello!\n\n![Chart](/writing/notes/new-post/chart.png)\n\n![External](https://example.com/chart.png)\n",
      ))
      .mockResolvedValueOnce(Response.json({ groups: [{ id: "notes", name: "My notes" }] }));

    const result = await getPublishedWritingPost("notes", "new-post");
    expect(result?.post).toMatchObject({
      title: "New post", groupName: "My notes", date: "2026-09-18",
      href: "/writing/notes/new-post", body: expect.stringContaining("Hello!"),
    });
    expect(result?.imageSources).toEqual({
      "/writing/notes/new-post/chart.png":
        `/api/writing/image?group=notes&slug=new-post&filename=chart.png&ref=${revision}`,
    });
    expect(fetchMock.mock.calls.slice(1).map(([url]) => url)).toEqual([
      `https://api.github.com/repos/seungjun-green/personalWebsite/contents/content/writing/posts/notes/new-post.md?ref=${revision}`,
      `https://api.github.com/repos/seungjun-green/personalWebsite/contents/content/writing/groups.json?ref=${revision}`,
    ]);
    expect(fetchMock.mock.calls.every(([, options]) => options.cache === "no-store")).toBe(true);
    expect(JSON.stringify(result)).not.toContain("test-token");
  });

  it("checks again after a missing URL is published", async () => {
    fetchMock.mockResolvedValueOnce(head()).mockResolvedValueOnce(new Response(null, { status: 404 }));
    expect(await getPublishedWritingPost("notes", "new-post")).toBeNull();

    fetchMock.mockResolvedValueOnce(head())
      .mockResolvedValueOnce(new Response("Just published"))
      .mockResolvedValueOnce(Response.json({ groups: [] }));
    expect((await getPublishedWritingPost("notes", "new-post"))?.post.body).toBe("Just published");
  });

  it.each([403, 429, 500])("does not turn GitHub failure %s into a missing post", async (status) => {
    fetchMock.mockResolvedValueOnce(head()).mockResolvedValueOnce(new Response(null, { status }));
    await expect(getPublishedWritingPost("notes", "new-post")).rejects.toThrow("Unable to load published writing");
  });

  it("does not interpret a missing or inaccessible repository as a missing post", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
    await expect(getPublishedWritingPost("notes", "new-post")).rejects.toThrow("Unable to load the writing repository");
  });

  it("does not fetch remote posts during local editing or without publishing configured", async () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(await getPublishedWritingPost("notes", "new-post")).toBeNull();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("GITHUB_CONTENT_PAT", "");
    expect(await getPublishedWritingPost("notes", "new-post")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects invalid paths and mutable revisions before contacting GitHub", async () => {
    expect(await getPublishedWritingPost("..", "new-post")).toBeNull();
    await expect(readPublishedWritingFile("content/writing/../../.env", revision)).rejects.toThrow("Invalid writing path");
    await expect(readPublishedWritingFile(".env", revision)).rejects.toThrow("Invalid writing path");
    await expect(readPublishedWritingFile("content/writing/groups.json", "main")).rejects.toThrow("Invalid writing revision");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
