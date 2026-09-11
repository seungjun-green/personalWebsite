// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WritingEditor from "./WritingEditor";

const navigation = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
}));

describe("WritingEditor", () => {
  beforeEach(() => {
    navigation.push.mockReset();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:preview"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("lets a user type into a new empty post", async () => {
    const user = userEvent.setup();
    render(<WritingEditor groups={[]} />);

    const body = screen.getByRole("textbox", { name: "Body" });
    await user.type(body, "A new post");

    expect(body).toHaveProperty("value", "A new post");
  });

  it("locks the draft while a save is in flight", async () => {
    let finishRequest!: (response: Response) => void;
    const request = new Promise<Response>((resolve) => {
      finishRequest = resolve;
    });
    vi.stubGlobal("fetch", vi.fn(() => request));
    const user = userEvent.setup();
    render(<WritingEditor groups={[]} />);

    await user.type(screen.getByRole("combobox", { name: "Group name" }), "Notes");
    await user.type(screen.getByRole("textbox", { name: "Title" }), "Draft");
    const body = screen.getByRole("textbox", { name: "Body" });
    await user.type(body, "Original body");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect((body as HTMLTextAreaElement).disabled).toBe(true);
    expect(
      (screen.getByRole("textbox", { name: "Title" }) as HTMLTextAreaElement)
        .disabled,
    ).toBe(true);

    finishRequest(
      new Response(
        JSON.stringify({ post: { href: "/writing/notes/draft" } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    await waitFor(() => expect(navigation.push).toHaveBeenCalled());
  });

  it("locks the draft while a local image upload is in flight", async () => {
    let finishRequest!: (response: Response) => void;
    const request = new Promise<Response>((resolve) => {
      finishRequest = resolve;
    });
    vi.stubGlobal("fetch", vi.fn(() => request));
    const user = userEvent.setup();
    render(<WritingEditor groups={[]} />);

    await user.type(screen.getByRole("combobox", { name: "Group name" }), "Notes");
    await user.type(screen.getByRole("textbox", { name: "Title" }), "Images");
    const body = screen.getByRole("textbox", { name: "Body" });
    const file = new File([new Uint8Array([137, 80, 78, 71])], "chart.png", {
      type: "image/png",
    });
    fireEvent.paste(body, { clipboardData: { files: [file] } });

    await waitFor(() => expect((body as HTMLTextAreaElement).disabled).toBe(true));
    finishRequest(
      new Response(
        JSON.stringify({ url: "/writing/notes/images/chart.png" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    await waitFor(() =>
      expect(
        (screen.getByRole("textbox", { name: "Body" }) as HTMLTextAreaElement)
          .disabled,
      ).toBe(false),
    );
  });
});
