"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { WritingTree } from "../lib/writing";

type SidebarGroup = WritingTree["groups"][number];

export default function WritingSidebar({
  tree,
  editor,
  mode = "local",
  headSha,
}: {
  tree: WritingTree;
  editor: boolean;
  mode?: "local" | "github";
  headSha?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [managing, setManaging] = useState(false);
  const [groups, setGroups] = useState<SidebarGroup[]>(() => cloneGroups(tree.groups));
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [repositoryHead, setRepositoryHead] = useState(headSha);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function beginManaging() {
    setGroups(cloneGroups(tree.groups));
    setRepositoryHead(headSha);
    setStatus("");
    setManaging(true);
  }

  function cancelManaging() {
    setGroups(cloneGroups(tree.groups));
    setStatus("");
    setManaging(false);
  }

  function renameGroup(id: string, name: string) {
    setGroups((current) =>
      current.map((group) => (group.id === id ? { ...group, name } : group)),
    );
  }

  function reorderGroups(event: DragEndEvent) {
    const activeId = String(event.active.id).replace("group:", "");
    const overId = event.over ? String(event.over.id).replace("group:", "") : null;
    if (!overId || activeId === overId) return;
    setGroups((current) => {
      const from = current.findIndex((group) => group.id === activeId);
      const to = current.findIndex((group) => group.id === overId);
      return from === -1 || to === -1 ? current : arrayMove(current, from, to);
    });
  }

  function reorderPosts(groupId: string, event: DragEndEvent) {
    const activeSlug = String(event.active.id).replace(`post:${groupId}:`, "");
    const overSlug = event.over
      ? String(event.over.id).replace(`post:${groupId}:`, "")
      : null;
    if (!overSlug || activeSlug === overSlug) return;
    setGroups((current) =>
      current.map((group) => {
        if (group.id !== groupId) return group;
        const from = group.posts.findIndex((post) => post.slug === activeSlug);
        const to = group.posts.findIndex((post) => post.slug === overSlug);
        return from === -1 || to === -1
          ? group
          : { ...group, posts: arrayMove(group.posts, from, to) };
      }),
    );
  }

  async function saveOrganization() {
    setSaving(true);
    setStatus("");
    try {
      const response = await fetch("/api/writing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedHead: mode === "github" ? repositoryHead : undefined,
          groups: groups.map((group) => ({
            id: group.id,
            name: group.name,
            postOrder: group.posts.map((post) => post.slug),
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Update failed.");
      if (data.commit?.sha) setRepositoryHead(data.commit.sha);
      setStatus("Saved.");
      setManaging(false);
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Update failed.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteWritingPost(groupId: string, slug: string, title: string) {
    if (!window.confirm(`Delete “${title}” and all of its images?`)) return;
    setSaving(true);
    setStatus("");
    try {
      const response = await fetch("/api/writing", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId,
          slug,
          expectedHead: mode === "github" ? repositoryHead : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Delete failed.");
      if (data.commit?.sha) setRepositoryHead(data.commit.sha);
      setGroups((current) =>
        current.map((group) =>
          group.id === groupId
            ? { ...group, posts: group.posts.filter((post) => post.slug !== slug) }
            : group,
        ),
      );
      setStatus(
        mode === "github"
          ? "Deleted in GitHub. Vercel deployment is in progress."
          : "Deleted.",
      );
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Delete failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <aside className="md:sticky md:top-8">
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-[var(--ink-4)]">
        Writing
      </p>
      {editor && !managing && (
        <div className="mt-4 grid grid-cols-2 gap-2" aria-label="Writing actions">
          <button
            type="button"
            onClick={beginManaging}
            className="cursor-pointer border border-[var(--line-strong)] bg-white px-3 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[var(--ink-2)] transition-colors hover:border-[var(--cardinal)] hover:text-[var(--cardinal)]"
          >
            Manage
          </button>
          <Link
            href="/writing/new"
            className="writing-primary-action flex items-center justify-center border border-[var(--cardinal)] bg-[var(--cardinal)] px-3 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.12em] transition-colors hover:bg-[var(--cardinal-dark)]"
          >
            New post
          </Link>
        </div>
      )}
      {managing && (
        <p className="mt-3 text-[0.82rem] leading-5 text-[var(--ink-3)]">
          Drag to reorder. Rename groups inline.
        </p>
      )}
      {managing ? (
        <div className="mt-5">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={reorderGroups}
          >
            <SortableContext
              items={groups.map((group) => `group:${group.id}`)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-4">
                {groups.map((group) => (
                  <SortableGroup key={group.id} group={group}>
                    <div className="min-w-0 flex-1">
                      <input
                        aria-label={`Rename ${group.name}`}
                        value={group.name}
                        onChange={(event) => renameGroup(group.id, event.target.value)}
                        className="w-full border-b border-[var(--line-strong)] bg-transparent py-1 text-[0.82rem] font-semibold outline-none focus:border-[var(--cardinal)]"
                      />
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(event) => reorderPosts(group.id, event)}
                      >
                        <SortableContext
                          items={group.posts.map(
                            (post) => `post:${group.id}:${post.slug}`,
                          )}
                          strategy={verticalListSortingStrategy}
                        >
                          <ul className="mt-2 space-y-1 border-l border-[var(--line)] pl-3">
                            {group.posts.map((post) => (
                              <SortablePost
                                key={post.slug}
                                groupId={group.id}
                                post={post}
                                onDelete={() =>
                                  void deleteWritingPost(
                                    group.id,
                                    post.slug,
                                    post.title,
                                  )
                                }
                              />
                            ))}
                          </ul>
                        </SortableContext>
                      </DndContext>
                    </div>
                  </SortableGroup>
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveOrganization()}
              className="cursor-pointer bg-[var(--cardinal)] px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={cancelManaging}
              className="cursor-pointer text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[var(--ink-3)]"
            >
              Cancel
            </button>
          </div>
          {status && (
            <p className="mt-3 text-[0.82rem] leading-5 text-[var(--ink-3)]">
              {status}
            </p>
          )}
        </div>
      ) : tree.groups.length === 0 ? (
        <p className="mt-4 text-[0.9rem] leading-6 text-[var(--ink-3)]">
          No groups yet.
        </p>
      ) : (
        <nav aria-label="Writing groups" className="mt-5 space-y-5">
          {tree.groups.map((group) => (
            <div key={group.id}>
              <p className="text-[0.82rem] font-semibold text-[var(--ink)]">
                {group.name}
              </p>
              {group.posts.length === 0 ? (
                <p className="mt-1.5 text-[0.85rem] text-[var(--ink-4)]">No posts</p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {group.posts.map((post) => {
                    const active = pathname === post.href;
                    return (
                      <li key={post.href}>
                        <Link
                          href={post.href}
                          aria-current={active ? "page" : undefined}
                          className={`writing-post-link block border-l-2 px-3 py-1.5 text-[0.88rem] leading-5 transition-colors ${
                            active
                              ? "border-[var(--cardinal)] bg-[var(--cardinal-tint)] font-medium text-[var(--cardinal)]"
                              : "border-[var(--line)] text-[var(--ink-3)] hover:border-[var(--cardinal)] hover:text-[var(--cardinal)]"
                          }`}
                        >
                          {post.title}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </nav>
      )}
    </aside>
  );
}

function SortableGroup({
  group,
  children,
}: {
  group: SidebarGroup;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: `group:${group.id}` });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "opacity-60" : ""}
    >
      <div className="flex items-start gap-2">
        <DragHandle label={`Reorder ${group.name}`} attributes={attributes} listeners={listeners} />
        {children}
      </div>
    </div>
  );
}

function SortablePost({
  groupId,
  post,
  onDelete,
}: {
  groupId: string;
  post: SidebarGroup["posts"][number];
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: `post:${groupId}:${post.slug}` });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 py-0.5 ${isDragging ? "opacity-60" : ""}`}
    >
      <DragHandle
        label={`Reorder ${post.title}`}
        attributes={attributes}
        listeners={listeners}
      />
      <span className="min-w-0 truncate text-[0.86rem] text-[var(--ink-3)]">
        {post.title}
      </span>
      <button
        type="button"
        onClick={onDelete}
        className="ml-auto shrink-0 cursor-pointer text-[1rem] leading-none text-[var(--ink-4)] hover:text-[var(--cardinal)]"
        aria-label={`Delete ${post.title}`}
      >
        ×
      </button>
    </li>
  );
}

function DragHandle({
  label,
  attributes,
  listeners,
}: {
  label: string;
  attributes: ReturnType<typeof useSortable>["attributes"];
  listeners: ReturnType<typeof useSortable>["listeners"];
}) {
  return (
    <button
      type="button"
      aria-label={label}
      {...attributes}
      {...listeners}
      className="shrink-0 cursor-grab touch-none select-none text-[1rem] leading-none text-[var(--ink-4)] active:cursor-grabbing"
    >
      ≡
    </button>
  );
}

function cloneGroups(groups: WritingTree["groups"]): SidebarGroup[] {
  return groups.map((group) => ({ ...group, posts: [...group.posts] }));
}
