import { getWritingTree } from "../lib/writing";
import { WritingAdminProvider } from "./WritingAdminContext";
import WritingChrome from "./WritingChrome";
import WritingSidebarPanel from "./WritingSidebarPanel";

export default function WritingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tree = getWritingTree();

  return (
    <WritingAdminProvider initialTree={tree}>
      <WritingChrome sidebar={<WritingSidebarPanel />}>
        {children}
      </WritingChrome>
    </WritingAdminProvider>
  );
}
