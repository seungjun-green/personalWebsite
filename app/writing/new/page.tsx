import { redirect } from "next/navigation";
import { getGithubWritingSnapshot } from "../../lib/github-writing";
import { getWritingTree } from "../../lib/writing";
import { getWritingAccess } from "../../lib/writing-auth";
import WritingEditor from "../WritingEditor";

export default async function NewWritingPage() {
  const access = await getWritingAccess();
  if (!access.allowed) redirect("/writing/admin");
  const snapshot =
    access.mode === "github" ? await getGithubWritingSnapshot() : null;
  const tree = snapshot?.tree ?? getWritingTree();
  return (
    <WritingEditor
      groups={tree.groups}
      mode={access.mode}
      headSha={snapshot?.headSha}
    />
  );
}
