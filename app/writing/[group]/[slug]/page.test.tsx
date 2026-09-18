import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPost: vi.fn(), getPublishedWritingPost: vi.fn(),
  notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }),
}));
vi.mock("../../../lib/writing", () => ({ getPost: mocks.getPost, listPosts: () => [] }));
vi.mock("../../../lib/published-writing", () => ({ getPublishedWritingPost: mocks.getPublishedWritingPost }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("../../WritingPostAdminActions", () => ({ default: () => null }));
vi.mock("../../WritingPostView", () => ({ default: () => null }));

import WritingPostPage, { dynamic } from "./page";

const post = {
  title: "New post", groupId: "notes", groupName: "Notes", slug: "new-post",
  date: "2026-09-18", href: "/writing/notes/new-post", body: "Published content",
};
const params = { group: "notes", slug: "new-post" };

describe("refreshing a published post", () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it("reads deployed posts without a GitHub dependency", async () => {
    mocks.getPost.mockReturnValue(post);
    const page = await WritingPostPage({ params: Promise.resolve(params) });
    expect(page.props.post).toEqual(post);
    expect(mocks.getPublishedWritingPost).not.toHaveBeenCalled();
  });

  it("renders a new post from GitHub on refresh before redeployment", async () => {
    mocks.getPost.mockReturnValue(null);
    const imageSources = { "/writing/notes/new-post/chart.png": "/api/writing/image?ref=abc" };
    mocks.getPublishedWritingPost.mockResolvedValue({ post, imageSources });
    const page = await WritingPostPage({ params: Promise.resolve(params) });
    expect(page.props.post).toEqual(post);
    expect(page.props.imageSources).toEqual(imageSources);
    expect(dynamic).toBe("force-dynamic");
    expect(mocks.getPublishedWritingPost).toHaveBeenCalledWith("notes", "new-post");
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it("returns 404 only after checking both deployed and published content", async () => {
    mocks.getPost.mockReturnValue(null);
    mocks.getPublishedWritingPost.mockResolvedValue(null);
    await expect(WritingPostPage({ params: Promise.resolve(params) })).rejects.toThrow("NOT_FOUND");
    expect(dynamic).toBe("force-dynamic");
  });

  it("sends upstream failures to the retry UI instead of returning 404", async () => {
    mocks.getPost.mockReturnValue(null);
    mocks.getPublishedWritingPost.mockRejectedValue(new Error("GitHub unavailable"));
    await expect(WritingPostPage({ params: Promise.resolve(params) })).rejects.toThrow("GitHub unavailable");
    expect(mocks.notFound).not.toHaveBeenCalled();
  });
});
