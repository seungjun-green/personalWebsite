// @vitest-environment jsdom

import { useSyncExternalStore } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWritingAdmin, WritingAdminProvider } from "./WritingAdminContext";
import WritingChrome from "./WritingChrome";
import WritingEditor from "./WritingEditor";
import WritingSidebar from "./WritingSidebar";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => useSyncExternalStore(
    (notify) => {
      window.addEventListener("test-navigation", notify);
      return () => window.removeEventListener("test-navigation", notify);
    },
    () => window.location.pathname,
    () => "/writing/new",
  ),
}));

function Sidebar() {
  const admin = useWritingAdmin();
  return <WritingSidebar key={admin.headSha ?? "initial"} {...admin} />;
}

describe("saving a post restores the sidebar", () => {
  beforeEach(() => {
    window.history.replaceState({ __NA: true }, "", "/writing/new");
    const replaceState = window.history.replaceState.bind(window.history);
    // Match Next.js: writes carrying its internal flag bypass pathname updates.
    vi.spyOn(window.history, "replaceState").mockImplementation((data, unused, url) => {
      replaceState({ ...data, __NA: true }, unused, url);
      if (!data?.__NA && !data?._N) window.dispatchEvent(new Event("test-navigation"));
    });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function renderEditor() {
    render(
      <WritingAdminProvider initialTree={{ groups: [] }}>
        <WritingChrome sidebar={<Sidebar />}>
          <WritingEditor groups={[]} mode="github" headSha="original-head" />
        </WritingChrome>
      </WritingAdminProvider>,
    );
  }

  it("shows the saved post and updated sidebar without resetting the editor state", async () => {
    const post = {
      title: "My new post", groupId: "notes", groupName: "Notes", slug: "my-new-post",
      href: "/writing/notes/my-new-post", date: "2026-09-18",
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/writing/admin/post") {
        return Response.json({ post, sha: "saved-head", url: "https://example.com/commit" });
      }
      return Response.json({
        editor: true, mode: "github", headSha: "saved-head",
        tree: { groups: [{ id: "notes", name: "Notes", posts: [post] }] },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderEditor();
    expect(screen.queryByRole("complementary")).toBeNull();
    await user.type(screen.getByRole("combobox", { name: "Group name" }), "Notes");
    await user.type(screen.getByRole("textbox", { name: "Title" }), post.title);
    await user.type(screen.getByRole("textbox", { name: "Body" }), "Freshly saved content");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("heading", { name: post.title })).toBeTruthy();
    expect(await screen.findByRole("complementary")).toBeTruthy();
    const sidebarLink = await screen.findByRole("link", { name: post.title });
    expect(sidebarLink.getAttribute("href")).toBe(post.href);
    expect(sidebarLink.getAttribute("aria-current")).toBe("page");
    expect(screen.getByText("Freshly saved content")).toBeTruthy();
    expect(window.location.pathname).toBe(post.href);

    await user.click(screen.getByRole("button", { name: "Edit post" }));
    await waitFor(() => expect(screen.queryByRole("complementary")).toBeNull());
    expect(screen.getByRole("textbox", { name: "Body" })).toHaveProperty("value", "Freshly saved content");
    expect(window.location.pathname).toBe(`${post.href}/edit`);
  });

  it("keeps the composing layout and draft when saving fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "Publish failed" }, { status: 500 })));
    const user = userEvent.setup();
    renderEditor();
    await user.type(screen.getByRole("textbox", { name: "Body" }), "Keep this draft");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Publish failed")).toBeTruthy();
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(screen.getByRole("textbox", { name: "Body" })).toHaveProperty("value", "Keep this draft");
    expect(window.location.pathname).toBe("/writing/new");
  });
});
