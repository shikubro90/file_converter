import { NextRequest, NextResponse } from "next/server";

const BAN_COOKIE = "blocked_until";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Never intercept the blocked page or Next.js internals
  if (pathname.startsWith("/_next") || pathname === "/favicon.ico" || pathname.startsWith("/blocked")) {
    return NextResponse.next();
  }

  const blockedUntil = req.cookies.get(BAN_COOKIE)?.value;
  if (!blockedUntil) return NextResponse.next();

  const expiry = parseInt(blockedUntil, 10);
  if (isNaN(expiry) || Date.now() >= expiry) {
    // Ban has expired — clear the cookie
    const res = NextResponse.next();
    res.cookies.delete(BAN_COOKIE);
    return res;
  }

  // Still banned
  if (pathname.startsWith("/api/")) {
    // Return JSON for API consumers
    return NextResponse.json(
      {
        error: "Your IP has been blocked for 1 hour due to suspicious activity. Please try again later.",
        blockedUntil: expiry,
      },
      { status: 403 }
    );
  }

  // Redirect page requests to the blocked page
  const url = req.nextUrl.clone();
  url.pathname = "/blocked";
  url.searchParams.set("until", String(expiry));
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
