// @vitest-environment jsdom

import {
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
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
    Object.defineProperty(window, "scrollBy", {
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

  it("identifies clipboard image bytes and inserts them at the active caret", async () => {
    const user = userEvent.setup();
    render(<WritingEditor groups={[]} mode="github" headSha="head" />);

    await user.type(screen.getByRole("combobox", { name: "Group name" }), "Notes");
    await user.type(screen.getByRole("textbox", { name: "Title" }), "Images");
    const body = screen.getByRole("textbox", { name: "Body" }) as HTMLTextAreaElement;
    await user.type(body, "BeforeAfter");
    body.setSelectionRange(6, 6);
    const file = new File(
      [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])],
      "clipboard-image",
      { type: "" },
    );
    const item = { kind: "file", getAsFile: () => file };

    fireEvent.paste(body, {
      clipboardData: { files: [], items: [item] },
    });

    await waitFor(() =>
      expect(body.value).toMatch(
        /^Before\n\n!\[clipboard-image\]\(\/writing\/notes\/images\/\d+-0-clipboard-image\.png\)\n\nAfter$/,
      ),
    );
    expect(screen.queryByRole("img", { name: "clipboard-image" })).toBeNull();
    expect(window.scrollBy).not.toHaveBeenCalled();
    expect(document.querySelector("form")?.getAttribute("style")).toContain(
      "overflow-anchor: none",
    );

    await user.click(screen.getByRole("button", { name: "Preview" }));
    expect(screen.getByRole("img", { name: "clipboard-image" })).toBeTruthy();
  });

  it("accepts a file exposed through drag items and inserts it at the drop point", async () => {
    const user = userEvent.setup();
    render(<WritingEditor groups={[]} mode="github" headSha="head" />);

    await user.type(screen.getByRole("combobox", { name: "Group name" }), "Notes");
    await user.type(screen.getByRole("textbox", { name: "Title" }), "Drag image");
    const body = screen.getByRole("textbox", { name: "Body" }) as HTMLTextAreaElement;
    await user.type(body, "Existing text");
    Object.defineProperty(body, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        top: 100,
        bottom: 300,
        left: 0,
        right: 600,
        width: 600,
        height: 200,
        x: 0,
        y: 100,
        toJSON: () => ({}),
      }),
    });
    const file = new File(
      [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])],
      "dropped-image",
      { type: "image/x-png" },
    );
    const item = { kind: "file", getAsFile: () => file };
    const dataTransfer = {
      types: ["Files"],
      items: [item],
      files: [],
      dropEffect: "none",
    };

    fireEvent.dragEnter(body, { dataTransfer });
    const dragOver = createEvent.dragOver(body);
    Object.defineProperties(dragOver, {
      clientY: { value: 150 },
      dataTransfer: { value: dataTransfer },
    });
    fireEvent(body, dragOver);
    expect(screen.getByTestId("image-drop-caret").style.top).toBe("50px");

    const dragOverAtStart = createEvent.dragOver(body);
    Object.defineProperties(dragOverAtStart, {
      clientY: { value: 100 },
      dataTransfer: { value: dataTransfer },
    });
    fireEvent(body, dragOverAtStart);
    expect(screen.getByTestId("image-drop-caret").style.top).toBe("0px");

    const drop = createEvent.drop(body);
    Object.defineProperties(drop, {
      clientY: { value: 100 },
      dataTransfer: { value: dataTransfer },
    });
    fireEvent(body, drop);

    await waitFor(() =>
      expect(body.value).toMatch(
        /^!\[dropped-image\]\(\/writing\/notes\/drag-image\/\d+-0-dropped-image\.png\)\n\nExisting text$/,
      ),
    );
    expect(screen.queryByRole("img", { name: "dropped-image" })).toBeNull();
    expect(window.scrollBy).not.toHaveBeenCalled();
  });
});
