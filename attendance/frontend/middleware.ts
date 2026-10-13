import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Never intercept API calls — backend handles auth itself.
  // Redirecting XHR/fetch to /login makes the client think 200 = logged in,
  // which causes an infinite redirect loop with the /dashboard page.
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Public pages always pass through
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const hasSession =
    req.cookies.has("access_token") || req.cookies.has("refresh_token");

  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    // Preserve the intended destination (optional, nice touch)
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Exclude /api, /_next, static files. Everything else goes through middleware.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|healthz).*)"],
};