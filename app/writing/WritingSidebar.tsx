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
}: {
  tree: WritingTree;
  editor: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [managing, setManaging] = useState(false);
  const [groups, setGroups] = useState<SidebarGroup[]>(() => cloneGroups(tree.groups));
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function beginManaging() {
    setGroups(cloneGroups(tree.groups));
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
          groups: groups.map((group) => ({
            id: group.id,
            name: group.name,
            postOrder: group.posts.map((post) => post.slug),
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Update failed.");
      setStatus("Saved.");
      setManaging(false);
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Update failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <aside className="md:sticky md:top-10">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[0.74rem] font-semibold uppercase tracking-[0.18em] text-[var(--ink-4)]">
          Writing
        </p>
        {editor && !managing && (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={beginManaging}
              className="cursor-pointer text-[0.74rem] font-medium uppercase tracking-[0.12em] text-[var(--cardinal)]"
            >
              Manage
            </button>
            <Link
              href="/writing/new"
              className="text-[0.74rem] font-medium uppercase tracking-[0.12em]"
            >
              New post
            </Link>
          </div>
        )}
      </div>
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
                <ul className="mt-1.5 space-y-1 border-l border-[var(--line)] pl-3">
                  {group.posts.map((post) => {
                    const active = pathname === post.href;
                    return (
                      <li key={post.href}>
                        <Link
                          href={post.href}
                          className={
                            active
                              ? "text-[0.9rem] text-[var(--cardinal)] no-underline"
                              : "text-[0.9rem] text-[var(--ink-3)] no-underline hover:text-[var(--cardinal)]"
                          }
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
}: {
  groupId: string;
  post: SidebarGroup["posts"][number];
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
