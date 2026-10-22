// ---------------------------------------------------------------------------
// safe-redirect — post-login return path
//
// When an anonymous user opens a protected page (e.g. a task email link to
// /projects/15), the middleware sends them to the login page with
// `?next=/projects/15`. After a successful login they are sent back there.
//
// Only same-origin, in-app paths are accepted so the parameter can never be
// abused as an open redirect to another site.
// ---------------------------------------------------------------------------

export const LOGIN_REDIRECT_PARAM = "next";

/** Paths that must never be used as a post-login destination. */
const BLOCKED_PREFIXES = ["/api/", "/connect-email"];

const MAX_LENGTH = 2048;

/**
 * Returns `value` when it is a safe internal path to land on after login,
 * otherwise `null`.
 */
export function getSafeRedirectPath(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  if (value.length === 0 || value.length > MAX_LENGTH) return null;

  // Must be a root-relative path: "/x" — never "//host", "/\host" or a scheme.
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value.includes("\\")) return null;
  if (value === "/") return null;

  // Resolve against a fixed origin: any trick that escapes the origin fails here.
  let parsed: URL;
  try {
    parsed = new URL(value, "http://internal.invalid");
  } catch {
    return null;
  }
  if (parsed.origin !== "http://internal.invalid") return null;

  if (BLOCKED_PREFIXES.some((prefix) => parsed.pathname.startsWith(prefix))) return null;

  return value;
}
