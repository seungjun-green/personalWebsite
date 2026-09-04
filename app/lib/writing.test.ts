import { describe, expect, it } from "vitest";
import {
  buildWritingTree,
  parseFrontMatter,
  removePostFromGroupOrder,
  serializePost,
  type WritingPostMeta,
} from "./writing";

describe("writing domain", () => {
  it("round-trips post frontmatter and Markdown", () => {
    const raw = serializePost({
      title: "A post",
      groupId: "notes",
      date: "2026-09-04",
      body: "## Heading\n\n**Body**\n",
    });
    expect(parseFrontMatter(raw)).toEqual({
      data: { title: "A post", group: "notes", date: "2026-09-04" },
      body: "## Heading\n\n**Body**\n",
    });
  });

  it("applies explicit post ordering", () => {
    const posts: WritingPostMeta[] = ["first", "second"].map((slug) => ({
      title: slug,
      groupId: "notes",
      groupName: "Notes",
      slug,
      date: "2026-09-04",
      href: `/writing/notes/${slug}`,
    }));
    const tree = buildWritingTree(
      [{ id: "notes", name: "Notes", postOrder: ["second", "first"] }],
      posts,
    );
    expect(tree.groups[0].posts.map((post) => post.slug)).toEqual([
      "second",
      "first",
    ]);
  });

  it("removes a deleted post from only its group order", () => {
    const groups = removePostFromGroupOrder(
      [
        { id: "notes", name: "Notes", postOrder: ["one", "two"] },
        { id: "other", name: "Other", postOrder: ["one"] },
      ],
      "notes",
      "one",
    );
    expect(groups[0].postOrder).toEqual(["two"]);
    expect(groups[1].postOrder).toEqual(["one"]);
  });
});
