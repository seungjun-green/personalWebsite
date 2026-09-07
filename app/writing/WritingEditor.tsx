"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { WritingGroup, WritingPost } from "../lib/writing";
import { slugify } from "../lib/slug";
import DeletePostButton from "./DeletePostButton";
import WritingMarkdown from "./WritingMarkdown";

type Props = {
  groups: WritingGroup[];
  post?: WritingPost | null;
  mode?: "local" | "github";
  headSha?: string;
};

type PendingImage = {
  file: File;
  filename: string;
};

const PUBLISHABLE_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

export default function WritingEditor({
  groups,
  post,
  mode = "local",
  headSha,
}: Props) {
  const router = useRouter();
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState(post?.title ?? "");
  const [groupName, setGroupName] = useState(post?.groupName ?? "");
  const [content, setContent] = useState(post?.body ?? "");
  const [dragging, setDragging] = useState(false);
  const dragCount = useRef(0);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [bodyMode, setBodyMode] = useState<"edit" | "preview">("edit");
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [repositoryHead, setRepositoryHead] = useState(headSha);
  const [commitUrl, setCommitUrl] = useState("");

  const slug = useMemo(() => slugify(title || post?.slug || "untitled"), [title, post?.slug]);
  const effectiveSlug = post?.slug ?? slug;
  const groupOptions = useMemo(
    () => Array.from(new Set(groups.map((g) => g.name))),
    [groups],
  );
  const groupId = useMemo(() => {
    const selected = groups.find((group) => group.name === groupName.trim());
    if (selected) return selected.id;
    if (post && groupName.trim() === post.groupName) return post.groupId;
    return undefined;
  }, [groupName, groups, post]);

  useEffect(() => {
    function preventFileNavigation(event: DragEvent) {
      if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
    }
    window.addEventListener("dragover", preventFileNavigation);
    window.addEventListener("drop", preventFileNavigation);
    return () => {
      window.removeEventListener("dragover", preventFileNavigation);
      window.removeEventListener("drop", preventFileNavigation);
    };
  }, []);

  useEffect(() => {
    autosize(titleRef.current, 52);
  }, [title]);

  useEffect(() => {
    if (bodyMode === "edit") autosize(textareaRef.current, 420);
  }, [content, bodyMode]);

  async function save() {
    setSaving(true);
    setStatus("");
    setCommitUrl("");
    try {
      if (mode === "github") {
        if (!repositoryHead) throw new Error("Repository version is missing. Refresh the page.");
        const form = new FormData();
        form.set(
          "payload",
          JSON.stringify({
            expectedHead: repositoryHead,
            title,
            groupName,
            groupId,
            slug: effectiveSlug,
            content,
            date: post?.date,
            previousGroupId: post?.groupId,
            previousSlug: post?.slug,
          }),
        );
        for (const image of pendingImages) {
          form.append("images", image.file, image.filename);
        }
        const response = await fetch("/api/writing/admin/post", {
          method: "POST",
          body: form,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Publish failed.");
        setRepositoryHead(data.sha);
        setPendingImages([]);
        setCommitUrl(data.url);
        setStatus("Committed to GitHub. Vercel deployment is in progress.");
        return;
      }

      const res = await fetch("/api/writing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          groupName,
          groupId,
          slug,
          content,
          date: post?.date,
          previousGroupId: post?.groupId,
          previousSlug: post?.slug,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setStatus("Saved. Commit and push from the terminal when you’re ready.");
      router.push(data.post.href);
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function addImages(files: FileList | File[]) {
    const images = Array.from(files).filter(
      (file) =>
        file.type.startsWith("image/") &&
        (mode === "local" || PUBLISHABLE_IMAGE_TYPES.has(file.type)),
    );
    if (images.length === 0) {
      setStatus(
        mode === "github"
          ? "Drop a PNG, JPEG, GIF, or WebP image."
          : "Drop an image file.",
      );
      return;
    }
    if (!title.trim() || !groupName.trim()) {
      setStatus("Set a group and title before adding images.");
      return;
    }

    const el = textareaRef.current;
    let start = el?.selectionStart ?? content.length;
    let end = el?.selectionEnd ?? start;
    let next = content;

    setStatus(images.length > 1 ? "Uploading images…" : "Uploading image…");
    try {
      for (const file of images) {
        const form = new FormData();
        form.set("file", file);
        form.set("title", title);
        form.set("groupName", groupName);
        if (groupId) form.set("groupId", groupId);
        form.set("slug", effectiveSlug);
        let imageUrl: string;
        if (mode === "github") {
          const extension = fileExtension(file);
          const base = slugify(file.name.replace(/\.[^.]+$/, "") || "image");
          const filename = `${Date.now()}-${images.indexOf(file)}-${base}${extension}`;
          const resolvedGroupId = groupId || slugify(groupName);
          imageUrl = `/writing/${resolvedGroupId}/${effectiveSlug}/${filename}`;
          setPendingImages((current) => [...current, { file, filename }]);
        } else {
          const res = await fetch("/api/writing/upload", { method: "POST", body: form });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Upload failed");
          imageUrl = data.url;
        }
        const snippet = `\n![${file.name}](${imageUrl})\n`;
        next = next.slice(0, start) + snippet + next.slice(end);
        start += snippet.length;
        end = start;
      }
      setContent(next);
      setStatus(
        mode === "github"
          ? `${images.length > 1 ? "Images" : "Image"} staged. Save to publish.`
          : images.length > 1
            ? "Images added."
            : "Image added.",
      );
      requestAnimationFrame(() => {
        el?.focus();
        el?.setSelectionRange(start, start);
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed");
    }
  }

  function hasFiles(event: React.DragEvent) {
    return Array.from(event.dataTransfer.types).includes("Files");
  }

  function onDragEnter(event: React.DragEvent) {
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    dragCount.current += 1;
    setDragging(true);
  }

  function onDragOver(event: React.DragEvent) {
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
  }

  function onDragLeave(event: React.DragEvent) {
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    dragCount.current = Math.max(0, dragCount.current - 1);
    if (dragCount.current === 0) setDragging(false);
  }

  function onDrop(event: React.DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    dragCount.current = 0;
    setDragging(false);
    if (event.dataTransfer.files?.length) {
      void addImages(event.dataTransfer.files);
    }
  }

  function onPaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const files = event.clipboardData.files;
    if (files?.length && Array.from(files).some((file) => file.type.startsWith("image/"))) {
      event.preventDefault();
      void addImages(files);
    }
  }

  return (
    <form
      className="writing-canvas relative"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="sticky top-0 z-10 mb-8 flex items-center justify-between gap-4 bg-white/90 py-2 font-sans backdrop-blur-sm">
        <div className="flex items-center gap-4" role="group" aria-label="Editor view">
          {(["edit", "preview"] as const).map((view) => (
            <button
              key={view}
              type="button"
              onClick={() => setBodyMode(view)}
              className={`cursor-pointer text-[0.78rem] tracking-[0.04em] ${
                bodyMode === view
                  ? "text-[var(--ink)] underline decoration-[var(--cardinal)] decoration-1 underline-offset-8"
                  : "text-[var(--ink-4)] hover:text-[var(--ink-2)]"
              }`}
            >
              {view === "edit" ? "Write" : "Preview"}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {status && <p className="text-[0.82rem] text-[var(--ink-3)]">{status}</p>}
          {commitUrl && (
            <a
              href={commitUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[0.82rem]"
            >
              View commit
            </a>
          )}
          {post ? (
            <DeletePostButton
              groupId={post.groupId}
              slug={post.slug}
              title={title.trim() || post.title}
              mode={mode}
              headSha={repositoryHead}
              className="cursor-pointer text-[0.78rem] text-[var(--ink-4)] hover:text-[var(--cardinal)] disabled:opacity-60"
            />
          ) : null}
          <button
            type="submit"
            disabled={saving}
            className="cursor-pointer rounded-full bg-[var(--cardinal)] px-4 py-1.5 text-[0.78rem] font-medium text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <input
        list="writing-groups"
        value={groupName}
        onChange={(e) => setGroupName(e.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.preventDefault();
        }}
        placeholder="Group"
        aria-label="Group name"
        className="w-full border-0 bg-transparent font-sans text-[0.74rem] font-semibold uppercase tracking-[0.16em] text-[var(--cardinal)] outline-none placeholder:text-[var(--ink-4)]"
      />
      <datalist id="writing-groups">
        {groupOptions.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      <textarea
        ref={titleRef}
        rows={1}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            textareaRef.current?.focus();
          }
        }}
        placeholder="Title"
        aria-label="Title"
        className="writing-editor-title mt-3"
      />

      {post?.date ? (
        <time className="mt-4 block font-sans text-[0.82rem] text-[var(--ink-4)]">
          {post.date}
        </time>
      ) : null}

      <div className="relative mt-8">
        {bodyMode === "edit" ? (
          <textarea
            ref={textareaRef}
            aria-label="Body"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onPaste={onPaste}
            placeholder="Start writing…"
            className="writing-editor-body"
          />
        ) : content.trim() ? (
          <WritingMarkdown>{content}</WritingMarkdown>
        ) : (
          <p className="text-[1.15rem] leading-8 text-[var(--ink-4)]">
            Nothing to preview yet.
          </p>
        )}
        {dragging && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-[0.92rem] text-[var(--cardinal)]">
            Drop image to insert
          </div>
        )}
      </div>
    </form>
  );
}

function autosize(el: HTMLTextAreaElement | null, minHeight: number) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${Math.max(el.scrollHeight, minHeight)}px`;
}

function fileExtension(file: File) {
  const match = file.name.match(/\.(png|jpe?g|gif|webp|svg)$/i);
  if (match) return match[0].toLowerCase();
  if (file.type === "image/jpeg") return ".jpg";
  if (file.type === "image/webp") return ".webp";
  if (file.type === "image/gif") return ".gif";
  if (file.type === "image/svg+xml") return ".svg";
  return ".png";
}
