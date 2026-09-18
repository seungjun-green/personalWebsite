"use client";

export default function WritingPostError({ reset }: { reset: () => void }) {
  return (
    <div role="alert">
      <h1 className="text-2xl font-semibold">This post couldn’t be loaded right now.</h1>
      <p className="mt-3 text-[var(--ink-2)]">Please try again in a moment.</p>
      <button type="button" onClick={reset} className="mt-5 cursor-pointer underline">
        Try again
      </button>
    </div>
  );
}
