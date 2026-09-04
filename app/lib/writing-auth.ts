import "server-only";

import { auth } from "../../auth";
import { isAllowedWritingOrigin, isAuthorizedGithubId } from "./github-admin";

export async function getWritingAccess() {
  if (process.env.NODE_ENV === "development") {
    return { allowed: true, mode: "local" as const, session: null };
  }

  const session = await auth();
  const allowed = isAuthorizedGithubId(session?.user?.githubId);
  return { allowed, mode: "github" as const, session };
}

export function isAllowedMutationOrigin(request: Request) {
  return isAllowedWritingOrigin(
    request.headers.get("origin"),
    request.url,
    process.env.APP_ALLOWED_ORIGINS ?? "",
    process.env.NODE_ENV === "development",
  );
}
