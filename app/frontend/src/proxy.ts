import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAME, parseAuthCookieValue } from "./lib/auth-cookie";

type Role = "guest" | "citizen" | "operator" | "admin";

const PUBLIC_ROUTES = ["/", "/login", "/signup", "/landing"];

const ROLE_ROUTES: Record<Exclude<Role, "guest">, string[]> = {
  citizen: ["/saved", "/my-tickets", "/history"],
  operator: ["/expert", "/knowledge"],
  admin: [
    "/saved",
    "/my-tickets",
    "/history",
    "/admin",
    "/expert",
    "/executive",
    "/knowledge",
  ],
};

function getAllowedPrefixes(role: Role): string[] {
  if (role === "guest") return [];
  return ROLE_ROUTES[role] ?? [];
}

function isRouteAllowed(pathname: string, role: Role): boolean {
  if (PUBLIC_ROUTES.includes(pathname)) return true;
  if (pathname === "/debug") return process.env.NODE_ENV === "development";

  const prefixes = getAllowedPrefixes(role);
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Read session cookie
  const rawCookie = request.cookies.get(COOKIE_NAME)?.value;
  const session = rawCookie ? parseAuthCookieValue(rawCookie) : null;
  const role: Role =
    session?.isLoggedIn && session.role ? session.role : "guest";

  // Debug route: block in production
  if (pathname === "/debug" && process.env.NODE_ENV !== "development") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Redirect logged-in users away from auth pages
  if (role !== "guest" && (pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Check route access
  if (!isRouteAllowed(pathname, role)) {
    const redirectTo = role === "guest" ? "/login" : "/";
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|shahem-logo\\.png|shahem-logo\\.svg|api).*)",
  ],
};
