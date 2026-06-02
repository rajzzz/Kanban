/**
 * Next.js Edge Middleware — session guard for protected routes.
 *
 * Why GET /auth/me instead of decoding the cookie directly:
 *   The access_token cookie is HttpOnly — middleware running in the Edge
 *   runtime CAN read request cookies, but validating a JWT requires the
 *   secret which should not be embedded in the frontend bundle.
 *   Calling GET /auth/me delegates validation to the backend and returns
 *   a clean 401 when the token is expired or absent.
 *
 * Flow:
 *   1. Public paths (/login, /register, static assets) → pass through.
 *   2. All other paths → call GET /auth/me forwarding cookies.
 *   3. 200  → session valid, continue.
 *   4. 401  → redirect to /login?from=<original-path> (so we can return
 *             the user after login).
 *   5. Network error → redirect to /login (fail-closed).
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Paths that do not require authentication
const PUBLIC_PATHS = ["/login", "/register", "/invite"];

// Asset patterns to skip entirely
const ASSET_PATTERN = /^\/((_next|favicon\.ico|robots\.txt|sitemap\.xml).*)/;

const BACKEND_INTERNAL_URL =
  process.env.BACKEND_INTERNAL_URL ?? "http://localhost:3001";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static assets and Next.js internals
  if (ASSET_PATTERN.test(pathname)) {
    return NextResponse.next();
  }

  // Allow public paths through
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Forward cookies so the backend can validate the access_token
  const cookieHeader = request.headers.get("cookie") ?? "";

  try {
    const res = await fetch(`${BACKEND_INTERNAL_URL}/auth/me`, {
      method: "GET",
      headers: {
        cookie: cookieHeader,
        "Content-Type": "application/json",
      },
      // Middleware runs on the Edge — no automatic cookie jar
      cache: "no-store",
    });

    if (res.ok) {
      // Session is valid — attach user info as a header for Server Components
      const user = (await res.json()) as {
        userId: string;
        workspaceId: string | null;
        role: string | null;
      };
      const response = NextResponse.next();
      response.headers.set("x-user-id", user.userId);
      if (user.workspaceId) {
        response.headers.set("x-workspace-id", user.workspaceId);
      }
      return response;
    }

    // 401 or any non-ok response → redirect to login
  } catch {
    // Network error (backend down etc.) → fail-closed, redirect to login
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Run on all paths except api, _next/static, _next/image, favicon.ico
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
