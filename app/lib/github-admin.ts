export function isAuthorizedGithubId(id: string | undefined) {
  const allowed = new Set(
    (process.env.AUTHORIZED_GITHUB_USER_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  return Boolean(id && allowed.has(id));
}

export function isAllowedWritingOrigin(
  origin: string | null,
  requestUrl: string,
  configuredOrigins: string,
  development: boolean,
) {
  if (development) return true;
  if (!origin) return false;
  const allowed = new Set([
    new URL(requestUrl).origin,
    ...configuredOrigins
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  ]);
  return allowed.has(origin);
}
