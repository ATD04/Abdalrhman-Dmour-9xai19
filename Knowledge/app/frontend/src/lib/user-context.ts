import { clearAuthCookie } from "./auth-cookie";

export type AppRole = "citizen" | "operator" | "admin";

const STORAGE_KEY = "shahem.app.session";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export type StoredSession = {
  isLoggedIn: boolean;
  userEmail: string;
  role: AppRole;
  lang: "en" | "ar";
  sidebarCollapsed: boolean;
  themeMode: "light" | "dark";
  expiresAt?: number;
};

export function normalizeOwnerId(isLoggedIn: boolean, userEmail: string): string {
  if (isLoggedIn && userEmail.trim()) return userEmail.trim().toLowerCase();
  return "guest";
}

export function mapLegacyRole(role: string): AppRole {
  switch (role) {
    case "user": return "citizen";
    case "expert":
    case "curator": return "operator";
    case "admin":
    case "executive": return "admin";
    case "citizen":
    case "operator":
      return role as AppRole;
    default: return "citizen";
  }
}

export function loadStoredSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (!parsed || typeof parsed !== "object") return null;

    // Check session expiry
    if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
      clearStoredSession();
      return null;
    }

    return {
      isLoggedIn: Boolean(parsed.isLoggedIn),
      userEmail: String(parsed.userEmail || ""),
      role: mapLegacyRole(parsed.role as string) || "citizen",
      lang: parsed.lang === "ar" ? "ar" : "en",
      sidebarCollapsed: Boolean(parsed.sidebarCollapsed),
      themeMode: parsed.themeMode === "dark" ? "dark" : "light",
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

export function saveStoredSession(session: StoredSession): void {
  if (typeof window === "undefined") return;
  // Set expiry if not already set
  if (!session.expiresAt && session.isLoggedIn) {
    session.expiresAt = Date.now() + SESSION_TTL_MS;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  clearAuthCookie();
}
