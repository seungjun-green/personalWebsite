"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  normalizeMarkdownImageSpacing,
  tokenizeMarkdownImages,
} from "../lib/markdown-images";
import type { WritingGroup, WritingPost } from "../lib/writing";
import { slugify } from "../lib/slug";
import DeletePostButton from "./DeletePostButton";
import WritingMarkdown from "./WritingMarkdown";
import WritingPostView from "./WritingPostView";
import {
  autosizeTextarea,
  droppedFiles,
  fileExtension,
  growTextarea,
  resizeTextareaWithoutCollapsing,
  supportedImageFiles,
} from "./writing-editor-utils";

type Props = {
  groups: WritingGroup[];
  post?: WritingPost | null;
  mode?: "local" | "github";
  headSha?: string;
};

type PendingImage = {
  file: File;
  filename: string;
  url: string;
};

export default function WritingEditor({
  groups,
  post,
  mode = "local",
  headSha,
}: Props) {
  const router = useRouter();
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingCaretRef = useRef<number | null>(null);
  const imagePreviewsRef = useRef<Record<string, string>>({});
  const operationInFlightRef = useRef(false);
  const [title, setTitle] = useState(post?.title ?? "");
  const [groupName, setGroupName] = useState(post?.groupName ?? "");
  const [content, setContent] = useState(() =>
    normalizeMarkdownImageSpacing(post?.body ?? ""),
  );
  const [dragging, setDragging] = useState(false);
  const dragCount = useRef(0);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [bodyMode, setBodyMode] = useState<"edit" | "preview">("edit");
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [imagePreviews, setImagePreviews] = useState<Record<string, string>>({});
  const [repositoryHead, setRepositoryHead] = useState(headSha);
  const [commitUrl, setCommitUrl] = useState("");
  const [publishedPost, setPublishedPost] = useState<WritingPost | null>(null);
  const busy = saving || uploading;

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
  const registerBodyTextarea = useCallback((element: HTMLTextAreaElement | null) => {
    if (!element) return;
    textareaRef.current = element;
    autosizeTextarea(element, 420);
  }, []);

  function restoreCaretWithoutScrolling() {
    const caret = pendingCaretRef.current;
    if (caret === null) return;
    const target = textareaRef.current;
    pendingCaretRef.current = null;
    if (!target) return;
    const localCaret = Math.min(Math.max(caret, 0), target.value.length);
    growTextarea(target, 420);
    target.focus({ preventScroll: true });
    target.setSelectionRange(localCaret, localCaret);
    textareaRef.current = target;
  }

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

  useLayoutEffect(() => {
    autosizeTextarea(titleRef.current, 52);
  }, []);

  useLayoutEffect(() => {
    restoreCaretWithoutScrolling();
  }, [content, bodyMode]);

  useEffect(
    () => () => {
      for (const previewUrl of Object.values(imagePreviewsRef.current)) {
        URL.revokeObjectURL(previewUrl);
      }
    },
    [],
  );

  async function save() {
    if (operationInFlightRef.current) return;
    operationInFlightRef.current = true;
    setSaving(true);
    setStatus("");
    setCommitUrl("");
    const normalizedContent = normalizeMarkdownImageSpacing(content);
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
            content: normalizedContent,
            date: post?.date,
            previousGroupId: post?.groupId,
            previousSlug: post?.slug,
          }),
        );
        const referencedImages = new Set(
          tokenizeMarkdownImages(normalizedContent)
            .filter((token) => token.type === "image")
            .map((token) => token.url),
        );
        for (const image of pendingImages.filter((image) =>
          referencedImages.has(image.url),
        )) {
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
        const savedPost = { ...data.post, body: normalizedContent } as WritingPost;
        window.history.replaceState(window.history.state, "", savedPost.href);
        setPublishedPost(savedPost);
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
          content: normalizedContent,
          date: post?.date,
          previousGroupId: post?.groupId,
          previousSlug: post?.slug,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setStatus("Saved. Commit and push from the terminal when you’re ready.");
      router.push(data.post.href);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
      operationInFlightRef.current = false;
    }
  }

  async function addImages(
    files: FileList | File[],
    insertion?: { start: number; end: number },
  ) {
    const images = await supportedImageFiles(files);
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
    if (operationInFlightRef.current) return;
    operationInFlightRef.current = true;
    setUploading(true);

    const el = textareaRef.current;
    let start =
      insertion?.start ?? el?.selectionStart ?? content.length;
    let end = insertion?.end ?? el?.selectionEnd ?? start;
    let next = content;

    setStatus(images.length > 1 ? "Uploading images…" : "Uploading image…");
    try {
      let lastInsertedUrl = "";
      for (const file of images) {
        const form = new FormData();
        form.set("file", file);
        form.set("title", title);
        form.set("groupName", groupName);
        if (groupId) form.set("groupId", groupId);
        form.set("slug", effectiveSlug);
        let imageUrl: string;
        let filename: string;
        if (mode === "github") {
          const extension = fileExtension(file);
          const base = slugify(file.name.replace(/\.[^.]+$/, "") || "image");
          filename = `${Date.now()}-${images.indexOf(file)}-${base}${extension}`;
          const resolvedGroupId = groupId || slugify(groupName);
          imageUrl = `/writing/${resolvedGroupId}/${effectiveSlug}/${filename}`;
        } else {
          const res = await fetch("/api/writing/upload", { method: "POST", body: form });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Upload failed");
          imageUrl = data.url;
          filename = imageUrl.split("/").pop() || file.name;
        }
        const previewUrl = URL.createObjectURL(file);
        imagePreviewsRef.current[imageUrl] = previewUrl;
        setPendingImages((current) => [
          ...current,
          { file, filename, url: imageUrl },
        ]);
        setImagePreviews((current) => ({
          ...current,
          [imageUrl]: previewUrl,
        }));
        const alt = slugify(file.name.replace(/\.[^.]+$/, "") || "image");
        const snippet = `\n\n![${alt}](${imageUrl})\n\n`;
        next = next.slice(0, start) + snippet + next.slice(end);
        lastInsertedUrl = imageUrl;
        start += snippet.length;
        end = start;
      }
      next = normalizeMarkdownImageSpacing(next);
      const insertedImage = tokenizeMarkdownImages(next)
        .filter((token) => token.type === "image")
        .findLast((token) => token.url === lastInsertedUrl);
      pendingCaretRef.current = insertedImage?.end ?? next.length;
      setContent(next);
      setStatus(
        mode === "github"
          ? `${images.length > 1 ? "Images" : "Image"} staged. Save to publish.`
          : images.length > 1
            ? "Images added."
            : "Image added.",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
      operationInFlightRef.current = false;
    }
  }

  function hasFiles(event: React.DragEvent) {
    return (
      Array.from(event.dataTransfer.types ?? []).includes("Files") ||
      Array.from(event.dataTransfer.items ?? []).some(
        (item) => item.kind === "file",
      )
    );
  }

  function onDragEnter(event: React.DragEvent<HTMLTextAreaElement>) {
    if (busy) return;
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragCount.current += 1;
    setDragging(true);
  }

  function onDragOver(event: React.DragEvent<HTMLTextAreaElement>) {
    if (busy) return;
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  function onDragLeave(event: React.DragEvent<HTMLTextAreaElement>) {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragCount.current = Math.max(0, dragCount.current - 1);
    if (dragCount.current === 0) {
      setDragging(false);
    }
  }

  function onDrop(event: React.DragEvent<HTMLTextAreaElement>) {
    event.preventDefault();
    if (busy) return;
    dragCount.current = 0;
    setDragging(false);

    const files = droppedFiles(event.dataTransfer);
    if (!files.length) {
      setStatus("No image file was found in that drop.");
      return;
    }
    const target = event.currentTarget;
    void addImages(files, {
      start: target.selectionStart,
      end: target.selectionEnd,
    });
  }

  function onPaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const files = droppedFiles(event.clipboardData);
    if (files.length) {
      event.preventDefault();
      void addImages(files);
    }
  }

  if (publishedPost) {
    return (
      <WritingPostView
        post={publishedPost}
        imageSources={imagePreviews}
        actions={
          <div className="flex items-center gap-3 font-sans">
            <span className="text-[0.76rem] text-[var(--ink-4)]">Saved</span>
            <button
              type="button"
              onClick={() => {
                window.history.replaceState(
                  window.history.state,
                  "",
                  `${publishedPost.href}/edit`,
                );
                setPublishedPost(null);
              }}
              className="cursor-pointer border border-[var(--line-strong)] px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[var(--ink-2)] transition-colors hover:border-[var(--cardinal)] hover:text-[var(--cardinal)]"
            >
              Edit post
            </button>
            <DeletePostButton
              groupId={publishedPost.groupId}
              slug={publishedPost.slug}
              title={publishedPost.title}
              mode={mode}
              headSha={repositoryHead}
              disabled={busy}
            />
          </div>
        }
      />
    );
  }

  return (
    <form
      className="writing-canvas relative"
      style={{ overflowAnchor: "none" }}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
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
              disabled={busy}
              className="cursor-pointer text-[0.78rem] text-[var(--ink-4)] hover:text-[var(--cardinal)] disabled:opacity-60"
            />
          ) : null}
          <Link
            href={post?.href ?? "/writing"}
            prefetch
            aria-disabled={busy}
            onClick={(event) => {
              if (busy) event.preventDefault();
            }}
            className={`writing-editor-cancel text-[0.78rem] ${
              busy ? "pointer-events-none opacity-50" : ""
            }`}
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={busy}
            className="cursor-pointer rounded-full bg-[var(--cardinal)] px-4 py-1.5 text-[0.78rem] font-medium text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : uploading ? "Adding image…" : "Save"}
          </button>
        </div>
      </div>

      <input
        disabled={busy}
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
        disabled={busy}
        ref={titleRef}
        rows={1}
        value={title}
        onChange={(event) => {
          const nextTitle = event.target.value;
          const shrank = nextTitle.length < title.length;
          const textarea = event.currentTarget;
          setTitle(nextTitle);
          requestAnimationFrame(() => {
            if (shrank) {
              resizeTextareaWithoutCollapsing(textarea, 52);
            } else {
              growTextarea(textarea, 52);
            }
          });
        }}
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

      <div className="relative mt-8 min-h-[62vh]">
        {bodyMode === "edit" ? (
          <div className="relative">
            <textarea
              disabled={busy}
              ref={registerBodyTextarea}
              rows={12}
              aria-label="Body"
              value={content}
              onChange={(event) => {
                const nextValue = event.target.value;
                const shrank = nextValue.length < content.length;
                const textarea = event.currentTarget;
                setContent(nextValue);
                requestAnimationFrame(() => {
                  if (shrank) {
                    resizeTextareaWithoutCollapsing(textarea, 420);
                  } else {
                    growTextarea(textarea, 420);
                  }
                });
              }}
              onPaste={onPaste}
              onDragEnter={onDragEnter}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              placeholder="Start writing…"
              className="writing-editor-segment writing-editor-markdown"
            />
            {dragging ? (
              <div className="pointer-events-none absolute inset-0 flex items-start justify-center border border-dashed border-[var(--cardinal)] bg-white/80 pt-6 font-sans text-[0.78rem] uppercase tracking-[0.16em] text-[var(--cardinal)]">
                Drop image to insert Markdown at the cursor
              </div>
            ) : null}
            <p className="mt-3 font-sans text-[0.74rem] text-[var(--ink-4)]">
              Images stay as Markdown in Write mode and render in Preview.
            </p>
          </div>
        ) : content.trim() ? (
          <WritingMarkdown>{content}</WritingMarkdown>
        ) : (
          <p className="text-[1.15rem] leading-8 text-[var(--ink-4)]">
            Nothing to preview yet.
          </p>
        )}
      </div>
    </form>
  );
}
