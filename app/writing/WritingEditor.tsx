"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type MarkdownImageToken,
  normalizeMarkdownImageSpacing,
  removeMarkdownImage,
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
  githubRawImageUrl,
  growTextarea,
  isSupportedImageFile,
  resizeTextareaWithoutCollapsing,
  textareaCaretTop,
  textareaDropOffsetAt,
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

type DraggedImage = Extract<MarkdownImageToken, { type: "image" }>;

type ViewportAnchor =
  | { top: number; imageUrl: string }
  | { top: number; contentOffset: number };

export default function WritingEditor({
  groups,
  post,
  mode = "local",
  headSha,
}: Props) {
  const router = useRouter();
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bodyRootRef = useRef<HTMLDivElement>(null);
  const pendingCaretRef = useRef<number | null>(null);
  const imagePreviewsRef = useRef<Record<string, string>>({});
  const draggedImageRef = useRef<DraggedImage | null>(null);
  const dropOffsetRef = useRef<number | null>(null);
  const pendingDropTopRef = useRef<number | null>(null);
  const pendingViewportAnchorRef = useRef<ViewportAnchor | null>(null);
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
  const [bodyLayoutVersion, setBodyLayoutVersion] = useState(0);
  const [repositoryHead, setRepositoryHead] = useState(headSha);
  const [commitUrl, setCommitUrl] = useState("");
  const [publishedPost, setPublishedPost] = useState<WritingPost | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [draggedImage, setDraggedImage] = useState<DraggedImage | null>(null);
  // Live pointer Y inside the body root (px) so the drop caret follows the
  // cursor continuously instead of snapping only to discrete drop zones.
  const [pointerY, setPointerY] = useState<number | null>(null);
  const dragActive = dragging || draggedImage !== null;
  const busy = saving || uploading;

  const slug = useMemo(() => slugify(title || post?.slug || "untitled"), [title, post?.slug]);
  const effectiveSlug = post?.slug ?? slug;
  const bodyTokens = useMemo(() => tokenizeMarkdownImages(content), [content]);
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
  const registerBodySegment = useCallback((element: HTMLTextAreaElement | null) => {
    if (!element) return;
    autosizeTextarea(element, element.dataset.emptyDocument === "true" ? 420 : 36);
    if (!textareaRef.current || !textareaRef.current.isConnected) {
      textareaRef.current = element;
    }
  }, []);

  function restoreCaretWithoutScrolling() {
    const caret = pendingCaretRef.current;
    if (caret === null) return;
    const segments = bodyRootRef.current?.querySelectorAll<HTMLTextAreaElement>(
      "textarea[data-content-start]",
    );
    const target = Array.from(segments ?? []).find((segment) => {
      const start = Number(segment.dataset.contentStart);
      const end = Number(segment.dataset.contentEnd);
      return caret >= start && caret <= end;
    });
    pendingCaretRef.current = null;
    if (!target) return;
    const localCaret = Math.min(
      Math.max(caret - Number(target.dataset.contentStart), 0),
      target.value.length,
    );
    target.focus({ preventScroll: true });
    target.setSelectionRange(localCaret, localCaret);
    textareaRef.current = target;
  }

  function restoreViewportAnchor() {
    const anchor = pendingViewportAnchorRef.current;
    const root = bodyRootRef.current;
    if (!anchor || !root) return;

    let targetTop: number | null = null;
    if ("imageUrl" in anchor) {
      const image = Array.from(
        root.querySelectorAll<HTMLElement>("[data-image-url]"),
      ).find((candidate) => candidate.dataset.imageUrl === anchor.imageUrl);
      targetTop = image?.getBoundingClientRect().top ?? null;
    } else {
      const textarea = Array.from(
        root.querySelectorAll<HTMLTextAreaElement>(
          "textarea[data-content-start]",
        ),
      ).find((candidate) => {
        const start = Number(candidate.dataset.contentStart);
        const end = Number(candidate.dataset.contentEnd);
        return anchor.contentOffset >= start && anchor.contentOffset <= end;
      });
      if (textarea) {
        const localOffset =
          anchor.contentOffset - Number(textarea.dataset.contentStart);
        targetTop =
          textarea.getBoundingClientRect().top +
          textareaCaretTop(textarea, localOffset);
      }
    }

    pendingViewportAnchorRef.current = null;
    if (targetTop !== null) {
      window.scrollBy(0, targetTop - anchor.top);
    }
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

  // Image operations split or join text segments. React can reuse a textarea
  // with the height of the old, much longer segment, creating a large blank
  // area around the image. Re-measure only after those structural operations,
  // not after ordinary typing.
  useLayoutEffect(() => {
    const segments = bodyRootRef.current?.querySelectorAll<HTMLTextAreaElement>(
      "textarea[data-content-start]",
    );
    for (const segment of segments ?? []) {
      autosizeTextarea(
        segment,
        segment.dataset.emptyDocument === "true" ? 420 : 36,
      );
    }
    restoreCaretWithoutScrolling();
    restoreViewportAnchor();
  }, [bodyLayoutVersion, bodyMode]);

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
    const images = Array.from(files).filter(
      (file) => isSupportedImageFile(file),
    );
    if (images.length === 0) {
      pendingDropTopRef.current = null;
      setStatus(
        mode === "github"
          ? "Drop a PNG, JPEG, GIF, or WebP image."
          : "Drop an image file.",
      );
      return;
    }
    if (!title.trim() || !groupName.trim()) {
      pendingDropTopRef.current = null;
      setStatus("Set a group and title before adding images.");
      return;
    }
    if (operationInFlightRef.current) return;
    operationInFlightRef.current = true;
    setUploading(true);

    const el = textareaRef.current;
    const segmentStart = Number(el?.dataset.contentStart ?? content.length);
    let start =
      insertion?.start ?? segmentStart + (el?.selectionStart ?? 0);
    let end = insertion?.end ?? segmentStart + (el?.selectionEnd ?? 0);
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
          // This function runs only in response to a drop or paste event.
          // eslint-disable-next-line react-hooks/purity
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
        if (
          pendingDropTopRef.current !== null &&
          pendingViewportAnchorRef.current === null
        ) {
          pendingViewportAnchorRef.current = {
            top: pendingDropTopRef.current,
            imageUrl,
          };
        }
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
      pendingDropTopRef.current = null;
      setContent(next);
      setBodyLayoutVersion((current) => current + 1);
      setStatus(
        mode === "github"
          ? `${images.length > 1 ? "Images" : "Image"} staged. Save to publish.`
          : images.length > 1
            ? "Images added."
            : "Image added.",
      );
    } catch (error) {
      pendingDropTopRef.current = null;
      setStatus(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
      operationInFlightRef.current = false;
    }
  }

  function removeImage(start: number, end: number, url: string) {
    const image = Array.from(
      bodyRootRef.current?.querySelectorAll<HTMLElement>("[data-image-url]") ??
        [],
    ).find(
      (candidate) =>
        candidate.dataset.imageUrl === url &&
        Number(candidate.dataset.contentStart) === start,
    );
    if (image) {
      pendingViewportAnchorRef.current = {
        top: image.getBoundingClientRect().top,
        contentOffset: start,
      };
    }
    const removed = removeMarkdownImage(content, start, end);
    setContent(removed.content);
    setBodyLayoutVersion((current) => current + 1);
    setSelectedImage(null);
    pendingCaretRef.current = removed.offset;
  }

  function insertAfterImage(
    token: DraggedImage,
    markdown: string,
  ) {
    const next = normalizeMarkdownImageSpacing(
      content.slice(0, token.end) + markdown + content.slice(token.end),
    );
    setContent(next);
    setBodyLayoutVersion((current) => current + 1);
    const inserted = tokenizeMarkdownImages(next)
      .filter((candidate) => candidate.type === "image")
      .find(
        (candidate) =>
          candidate.start >= token.end && candidate.raw === markdown,
      );
    if (inserted) setSelectedImage(`${inserted.start}:${inserted.url}`);
  }

  function moveImage(token: DraggedImage, targetOffset: number) {
    if (targetOffset >= token.start && targetOffset <= token.end) {
      draggedImageRef.current = null;
      dropOffsetRef.current = null;
      pendingViewportAnchorRef.current = null;
      setDraggedImage(null);
      setPointerY(null);
      return;
    }
    const removed = removeMarkdownImage(
      content,
      token.start,
      token.end,
      targetOffset,
    );
    const adjustedOffset = removed.offset;
    const next = normalizeMarkdownImageSpacing(
      removed.content.slice(0, adjustedOffset) +
        token.raw +
        removed.content.slice(adjustedOffset),
    );
    const moved = tokenizeMarkdownImages(next)
      .filter((candidate) => candidate.type === "image")
      .reduce<DraggedImage | null>((closest, candidate) => {
        if (candidate.url !== token.url) return closest;
        if (!closest) return candidate;
        return Math.abs(candidate.start - adjustedOffset) <
          Math.abs(closest.start - adjustedOffset)
          ? candidate
          : closest;
      }, null);
    setContent(next);
    setBodyLayoutVersion((current) => current + 1);
    setSelectedImage(moved ? `${moved.start}:${moved.url}` : null);
    draggedImageRef.current = null;
    dropOffsetRef.current = null;
    setDraggedImage(null);
    setPointerY(null);
  }

  // Between-block spacer that widens slightly during a drag so the caret has
  // room to visualize an insertion between two blocks. All drop routing goes
  // through the form-level onDrop / onDragOver so we don't need per-zone
  // handlers (which used to swallow drops via stopPropagation).
  function imageDropZone(_offset: number, key: string) {
    return (
      <div
        key={key}
        aria-hidden="true"
        className={`pointer-events-none transition-[height] ${
          dragActive ? "h-4" : "h-0"
        }`}
      />
    );
  }

  // Given a pointer Y (viewport coords), compute the character offset in
  // `content` where an image should drop. Walks the rendered body segments,
  // and inside a text-segment textarea does line-level arithmetic so the
  // offset lands right between paragraphs / lines instead of just at
  // block boundaries.
  function computeDropOffsetAt(clientY: number): number {
    const root = bodyRootRef.current;
    if (!root) return content.length;
    const segments = Array.from(
      root.querySelectorAll<HTMLElement>("[data-content-start]"),
    );
    if (!segments.length) return content.length;

    for (let index = 0; index < segments.length; index += 1) {
      const seg = segments[index];
      const rect = seg.getBoundingClientRect();
      const start = Number(seg.dataset.contentStart);
      const end = Number(seg.dataset.contentEnd);

      if (clientY < rect.top) {
        return start;
      }
      if (clientY > rect.bottom) continue;

      if (seg.tagName === "TEXTAREA") {
        const textarea = seg as HTMLTextAreaElement;
        return start + textareaDropOffsetAt(textarea, clientY);
      }

      // Image button (non-textarea): snap to the closer of start / end.
      const mid = (rect.top + rect.bottom) / 2;
      return clientY < mid ? start : end;
    }

    return Number(segments[segments.length - 1].dataset.contentEnd);
  }

  function updateDropOffsetFromPointer(clientY: number) {
    const root = bodyRootRef.current;
    if (!root) return;
    const rootRect = root.getBoundingClientRect();
    const localY = clientY - rootRect.top;
    setPointerY((current) => (current === localY ? current : localY));
    const offset = computeDropOffsetAt(clientY);
    dropOffsetRef.current = offset;
  }

  function hasFiles(event: React.DragEvent) {
    return (
      Array.from(event.dataTransfer.types).includes("Files") ||
      Array.from(event.dataTransfer.items).some((item) => item.kind === "file")
    );
  }

  function onDragEnter(event: React.DragEvent) {
    if (busy) return;
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    draggedImageRef.current = null;
    dragCount.current += 1;
    setDragging(true);
  }

  function onDragOver(event: React.DragEvent) {
    if (busy) return;
    const internalImage = draggedImageRef.current;
    if (!hasFiles(event) && !internalImage) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = internalImage ? "move" : "copy";
    updateDropOffsetFromPointer(event.clientY);
  }

  function onDragLeave(event: React.DragEvent) {
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    dragCount.current = Math.max(0, dragCount.current - 1);
    if (dragCount.current === 0) {
      setDragging(false);
      dropOffsetRef.current = null;
      setPointerY(null);
    }
  }

  function onDrop(event: React.DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (busy) return;
    dragCount.current = 0;
    setDragging(false);

    const target =
      dropOffsetRef.current ?? computeDropOffsetAt(event.clientY);
    const internalImage = draggedImageRef.current;
    const files = droppedFiles(event.dataTransfer);

    if (internalImage) {
      pendingViewportAnchorRef.current = {
        top: event.clientY,
        imageUrl: internalImage.url,
      };
      moveImage(internalImage, target);
      setStatus("Image moved.");
    } else if (files.length) {
      pendingDropTopRef.current = event.clientY;
      void addImages(files, { start: target, end: target });
    } else {
      setStatus("No image file was found in that drop.");
    }

    dropOffsetRef.current = null;
    setPointerY(null);
  }

  function onPaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const files = event.clipboardData.files;
    if (files?.length && Array.from(files).some((file) => file.type.startsWith("image/"))) {
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
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      onDragEnterCapture={onDragEnter}
      onDragOverCapture={onDragOver}
      onDragLeaveCapture={onDragLeave}
      onDropCapture={onDrop}
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

      <div ref={bodyRootRef} className="relative mt-8 min-h-[62vh]">
        {bodyMode === "edit" ? (
          <div>
            {bodyTokens.map((token, index) =>
              <Fragment key={`${token.type}-${token.start}-${index}`}>
                {imageDropZone(token.start, `drop-${index}`)}
                {token.type === "text" ? (
                  token.value.length === 0 && content.length > 0 ? null : (
                  <textarea
                    disabled={busy}
                    ref={registerBodySegment}
                    key={`segment-${token.start}-${bodyLayoutVersion}`}
                    rows={1}
                    data-empty-document={content.length === 0}
                    data-content-start={token.start}
                    data-content-end={token.end}
                    aria-label="Body"
                    value={token.value}
                    onFocus={(event) => {
                      textareaRef.current = event.currentTarget;
                      setSelectedImage(null);
                    }}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      const shrank = nextValue.length < token.value.length;
                      const textarea = event.currentTarget;
                      setContent(
                        (current) =>
                          current.slice(0, token.start) +
                          nextValue +
                          current.slice(token.end),
                      );
                      requestAnimationFrame(() => {
                        if (shrank) {
                          resizeTextareaWithoutCollapsing(textarea, 36);
                        } else {
                          growTextarea(textarea, 36);
                        }
                      });
                    }}
                    onPaste={onPaste}
                    placeholder={content.length === 0 ? "Start writing…" : undefined}
                    className="writing-editor-segment"
                  />
                  )
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    draggable={!busy}
                    data-content-start={token.start}
                    data-content-end={token.end}
                    data-image-url={token.url}
                    onClick={(event) => {
                      event.currentTarget.focus();
                      setSelectedImage(`${token.start}:${token.url}`);
                    }}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData(
                        "application/x-writing-image",
                        token.raw,
                      );
                      event.dataTransfer.setData("text/plain", token.raw);
                      draggedImageRef.current = token;
                      setDraggedImage(token);
                      setSelectedImage(`${token.start}:${token.url}`);
                    }}
                    onDragEnd={() => {
                      draggedImageRef.current = null;
                      dropOffsetRef.current = null;
                      setDraggedImage(null);
                      setPointerY(null);
                    }}
                    onCopy={(event) => {
                      event.preventDefault();
                      event.clipboardData.setData("text/plain", token.raw);
                      setStatus("Image copied.");
                    }}
                    onCut={(event) => {
                      event.preventDefault();
                      event.clipboardData.setData("text/plain", token.raw);
                      removeImage(token.start, token.end, token.url);
                      setStatus("Image cut.");
                    }}
                    onPaste={(event) => {
                      const files = event.clipboardData.files;
                      if (
                        files?.length &&
                        Array.from(files).some((file) =>
                          file.type.startsWith("image/"),
                        )
                      ) {
                        event.preventDefault();
                        void addImages(files, {
                          start: token.end,
                          end: token.end,
                        });
                        return;
                      }
                      const markdown = event.clipboardData.getData("text/plain");
                      if (!markdown) return;
                      event.preventDefault();
                      insertAfterImage(token, markdown);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Backspace" && event.key !== "Delete") {
                        return;
                      }
                      event.preventDefault();
                      removeImage(token.start, token.end, token.url);
                    }}
                    className={`my-5 block w-full cursor-grab border-2 bg-transparent p-1 text-left transition-colors active:cursor-grabbing ${
                      selectedImage === `${token.start}:${token.url}`
                        ? "border-[var(--cardinal)]"
                        : "border-transparent hover:border-[var(--line-strong)]"
                    }`}
                    aria-label={`${token.alt || "Image"}. Drag to move, or use Copy, Cut, Paste, Backspace, or Delete.`}
                  >
                    <img
                      src={imagePreviews[token.url] ?? token.url}
                      alt={token.alt || "Image"}
                      draggable={false}
                      onError={(event) => {
                        const preview = imagePreviewsRef.current[token.url];
                        if (preview && event.currentTarget.src !== preview) {
                          event.currentTarget.src = preview;
                          return;
                        }
                        if (event.currentTarget.dataset.fallbackApplied) return;
                        event.currentTarget.dataset.fallbackApplied = "true";
                        event.currentTarget.src = githubRawImageUrl(token.url);
                      }}
                      className="mx-auto block max-h-[70vh] max-w-full"
                    />
                    {selectedImage === `${token.start}:${token.url}` ? (
                      <span className="mt-2 block text-center font-sans text-[0.76rem] text-[var(--ink-4)]">
                        Drag to move · ⌘C copy · ⌘V paste · ⌘X cut · Backspace delete
                      </span>
                    ) : null}
                  </button>
                )}
              </Fragment>,
            )}
            {imageDropZone(content.length, "drop-end")}
          </div>
        ) : content.trim() ? (
          <WritingMarkdown>{content}</WritingMarkdown>
        ) : (
          <p className="text-[1.15rem] leading-8 text-[var(--ink-4)]">
            Nothing to preview yet.
          </p>
        )}
        {dragging && (
          <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center text-[0.82rem] uppercase tracking-[0.16em] text-[var(--cardinal)]">
            Drop image to insert
          </div>
        )}
        {dragActive && pointerY !== null ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 z-20 h-0"
            style={{ top: pointerY }}
          >
            <span className="absolute inset-x-0 top-0 block h-px bg-[var(--cardinal)] before:absolute before:-top-[3px] before:-left-1 before:size-[7px] before:rounded-full before:bg-[var(--cardinal)]" />
          </div>
        ) : null}
      </div>
    </form>
  );
}
