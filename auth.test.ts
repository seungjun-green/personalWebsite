import { afterEach, describe, expect, it } from "vitest";
import {
  isAllowedWritingOrigin,
  isAuthorizedGithubId,
} from "./app/lib/github-admin";

describe("GitHub admin allowlist", () => {
  const original = process.env.AUTHORIZED_GITHUB_USER_IDS;

  afterEach(() => {
    process.env.AUTHORIZED_GITHUB_USER_IDS = original;
  });

  it("authorizes only immutable numeric IDs in the allowlist", () => {
    process.env.AUTHORIZED_GITHUB_USER_IDS = "60959924,123";
    expect(isAuthorizedGithubId("60959924")).toBe(true);
    expect(isAuthorizedGithubId("seungjun-green")).toBe(false);
    expect(isAuthorizedGithubId("999")).toBe(false);
  });

  it("rejects missing and cross-site mutation origins in production", () => {
    const url = "https://site.example/api/writing";
    expect(isAllowedWritingOrigin(null, url, "", false)).toBe(false);
    expect(isAllowedWritingOrigin("https://evil.example", url, "", false)).toBe(false);
    expect(isAllowedWritingOrigin("https://site.example", url, "", false)).toBe(true);
    expect(
      isAllowedWritingOrigin(
        "https://admin.example",
        url,
        "https://admin.example",
        false,
      ),
    ).toBe(true);
  });
});
