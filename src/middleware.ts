import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Exempt health, auth endpoints, and workers (workers use signature verification)
  if (
    !pathname.startsWith("/api") ||
    pathname === "/api/health" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/workers")
  ) {
    return NextResponse.next();
  }

  // Guard all other /api routes with Better Auth session cookie
  const sessionCookie =
    request.cookies.get("better-auth.session_token") ||
    request.cookies.get("__Secure-better-auth.session_token");

  if (!sessionCookie || !sessionCookie.value) {
    return NextResponse.json(
      { error: "Unauthorized: Valid session required" },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
