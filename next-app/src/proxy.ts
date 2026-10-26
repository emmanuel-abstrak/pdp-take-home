import { NextResponse, type NextRequest } from "next/server";
import { isValidSlug } from "@/lib/article";
import { isMigrated } from "@/lib/migration";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const slug = pathname.slice("/articles/".length);

  if (pathname.startsWith("/legacy") || !isValidSlug(slug)) {
    return new NextResponse("Not found", { status: 404 });
  }

  if (isMigrated(slug)) {
    const response = NextResponse.next();
    response.headers.set("x-served-by", "next");
    return response;
  }

  return NextResponse.rewrite(new URL(`/legacy/articles/${slug}${search}`, request.url));
}

export const config = {
  matcher: ["/articles/:slug", "/legacy/:path*"],
};
