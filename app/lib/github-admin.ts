export function isAuthorizedGithubId(id: string | undefined) {
  return id === "60959924";
}

export function isAllowedWritingOrigin(
  origin: string | null,
  requestUrl: string,
  development: boolean,
) {
  if (development) return true;
  if (!origin) return false;
  return origin === new URL(requestUrl).origin;
}
