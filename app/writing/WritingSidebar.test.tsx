// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WritingSidebar from "./WritingSidebar";

const navigation = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/writing",
  useRouter: () => navigation,
}));

describe("WritingSidebar", () => {
  beforeEach(() => {
    navigation.refresh.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("adds a group and includes it in the saved organization", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ commit: { sha: "next-head" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(
      <WritingSidebar
        editor
        mode="github"
        headSha="current-head"
        tree={{
          groups: [
            { id: "notes", name: "Notes", postOrder: [], posts: [] },
          ],
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Manage groups" }));
    await user.type(screen.getByLabelText("New group"), "Research Notes");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(screen.getByLabelText("Rename Research Notes")).toBeTruthy();
    expect(
      screen.getByText("“Research Notes” added. Save changes to publish it."),
    ).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

    const [, options] = fetchMock.mock.calls[0] as unknown as [
      unknown,
      RequestInit,
    ];
    expect(JSON.parse(String(options?.body))).toEqual({
      expectedHead: "current-head",
      groups: [
        { id: "notes", name: "Notes", postOrder: [] },
        { id: "research-notes", name: "Research Notes", postOrder: [] },
      ],
    });
    expect(navigation.refresh).toHaveBeenCalledOnce();
  });
});
