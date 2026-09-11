// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  useWritingAdmin,
  WritingAdminProvider,
} from "./WritingAdminContext";

vi.mock("next/navigation", () => ({
  usePathname: () => "/writing",
}));

function StateProbe() {
  const state = useWritingAdmin();
  return <span>{state.loaded ? "loaded" : "loading"}</span>;
}

describe("WritingAdminProvider", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("finishes loading when the access endpoint fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 503 })));

    render(
      <WritingAdminProvider initialTree={{ groups: [] }}>
        <StateProbe />
      </WritingAdminProvider>,
    );

    expect(await screen.findByText("loaded")).toBeTruthy();
  });
});
