import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/chat" || pathname === "/chat/") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const sessionCookie =
    request.cookies.get("better-auth.session_token") ||
    request.cookies.get("__Secure-better-auth.session_token");
  const isAuthenticated = Boolean(sessionCookie && sessionCookie.value);

  if (pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up")) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (
    !pathname.startsWith("/api") ||
    pathname === "/api/health" ||
    pathname.startsWith("/api/auth")
  ) {
    return NextResponse.next();
  }

  // Guard all other /api routes with Better Auth session cookie
  if (!isAuthenticated) {
    return NextResponse.json(
      { error: "Unauthorized: Valid session required" },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/:path*",
    "/chat",
    "/chat/",
    "/sign-in",
    "/sign-up",
  ],
};
