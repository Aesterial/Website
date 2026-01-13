import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/technics" || pathname.startsWith("/technics/")) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/technics";
  return NextResponse.redirect(url, 307);
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)"],
};
