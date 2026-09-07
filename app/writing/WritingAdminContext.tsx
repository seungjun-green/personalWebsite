"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import type { WritingTree } from "../lib/writing";

type WritingAdminState = {
  loaded: boolean;
  editor: boolean;
  signedIn: boolean;
  mode: "local" | "github";
  headSha?: string;
  tree: WritingTree;
};

const WritingAdminContext = createContext<WritingAdminState | null>(null);

export function WritingAdminProvider({
  initialTree,
  children,
}: {
  initialTree: WritingTree;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const composing =
    pathname === "/writing/new" || /\/writing\/[^/]+\/[^/]+\/edit$/.test(pathname);
  const [state, setState] = useState<WritingAdminState>({
    loaded: false,
    editor: false,
    signedIn: false,
    mode: "github",
    tree: initialTree,
  });

  useEffect(() => {
    if (composing) return;

    const controller = new AbortController();

    async function loadAccess() {
      try {
        const response = await fetch("/api/writing", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data = (await response.json()) as {
          editor?: boolean;
          signedIn?: boolean;
          mode?: "local" | "github";
          headSha?: string;
          tree?: WritingTree;
        };
        setState({
          loaded: true,
          editor: Boolean(data.editor),
          signedIn: Boolean(data.signedIn),
          mode: data.mode ?? "github",
          headSha: data.headSha,
          tree: data.tree ?? initialTree,
        });
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setState((current) => ({ ...current, loaded: true }));
        }
      }
    }

    void loadAccess();
    return () => controller.abort();
  }, [composing, initialTree]);

  const value = useMemo(() => state, [state]);

  return (
    <WritingAdminContext.Provider value={value}>
      {children}
    </WritingAdminContext.Provider>
  );
}

export function useWritingAdmin() {
  const context = useContext(WritingAdminContext);
  if (!context) {
    throw new Error("useWritingAdmin must be used within WritingAdminProvider.");
  }
  return context;
}
