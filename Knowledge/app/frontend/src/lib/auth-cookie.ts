import type { AppRole } from "./user-context";

export const COOKIE_NAME = "shahem_session";

export interface SessionCookie {
  email: string;
  role: AppRole;
  isLoggedIn: boolean;
  expiresAt: number;
}

export function parseAuthCookieValue(raw: string): SessionCookie | null {
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    if (
      typeof parsed !== "object" ||
      !parsed ||
      typeof parsed.email !== "string" ||
      typeof parsed.role !== "string" ||
      typeof parsed.isLoggedIn !== "boolean" ||
      typeof parsed.expiresAt !== "number"
    ) {
      return null;
    }
    if (!["citizen", "operator", "admin"].includes(parsed.role)) return null;
    if (Date.now() > parsed.expiresAt) return null;
    return parsed as SessionCookie;
  } catch {
    return null;
  }
}

export function setAuthCookie(
  session: Omit<SessionCookie, "expiresAt">,
  ttlHours = 24
): void {
  const expiresAt = Date.now() + ttlHours * 60 * 60 * 1000;
  const value = encodeURIComponent(
    JSON.stringify({ ...session, expiresAt })
  );
  const maxAge = ttlHours * 60 * 60;
  document.cookie = `${COOKIE_NAME}=${value}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function getAuthCookieClient(): SessionCookie | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;
  return parseAuthCookieValue(match.split("=").slice(1).join("="));
}

export function clearAuthCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
}
