import type { NextRequest } from "next/server";
import { LEGACY_ORIGIN } from "@/lib/migration";

const TIMEOUT_MS = 10_000;
const DROP_REQUEST_HEADERS = ["host", "connection", "content-length", "accept-encoding"];
const DROP_RESPONSE_HEADERS = ["connection", "keep-alive", "transfer-encoding", "content-length", "content-encoding", "host", "x-powered-by"];

async function forward(request: NextRequest) {
  const path = request.nextUrl.pathname;
  console.log(JSON.stringify({ event: "legacy_fallback", path }));

  const headers = new Headers(request.headers);
  DROP_REQUEST_HEADERS.forEach((name) => headers.delete(name));
  headers.set("x-forwarded-host", request.headers.get("host") ?? "");
  headers.set("x-forwarded-proto", request.nextUrl.protocol.replace(":", ""));

  let upstream: Response;
  try {
    upstream = await fetch(LEGACY_ORIGIN + path + request.nextUrl.search, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer(),
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (cause) {
    return unavailable(path, String(cause));
  }
  if ([502, 503, 504].includes(upstream.status)) {
    return unavailable(path, `status ${upstream.status}`);
  }

  const responseHeaders = new Headers(upstream.headers);
  DROP_RESPONSE_HEADERS.forEach((name) => responseHeaders.delete(name));
  const location = responseHeaders.get("location");
  if (location?.startsWith(LEGACY_ORIGIN)) {
    responseHeaders.set("location", location.slice(LEGACY_ORIGIN.length) || "/");
  }
  responseHeaders.set("x-served-by", "legacy-php");
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}

function unavailable(path: string, reason: string) {
  console.error(JSON.stringify({ event: "legacy_unavailable", path, reason }));
  return new Response(OUTAGE_PAGE, {
    status: 503,
    headers: { "content-type": "text/html; charset=utf-8", "retry-after": "30", "x-served-by": "next" },
  });
}

const OUTAGE_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Temporarily unavailable · Acme News</title>
<style>
  :root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, sans-serif; }
  body { margin: 0; }
  header { border-bottom: 1px solid #8884; }
  header div, main { max-width: 48rem; margin: 0 auto; padding: 16px; }
  header a { font-weight: 600; font-size: 1.125rem; color: inherit; text-decoration: none; }
  main { padding-top: 40px; }
  main a { color: inherit; }
  h1 { font-size: 1.5rem; margin: 0; }
  p { opacity: 0.75; }
  .actions { opacity: 1; margin-top: 24px; display: flex; gap: 16px; align-items: center; }
  .button { background: CanvasText; color: Canvas; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-weight: 500; }
</style>
</head>
<body>
<header><div><a href="/articles">Acme News</a></div></header>
<main>
  <h1>This page is temporarily unavailable</h1>
  <p>We couldn&rsquo;t load it just now. This is usually brief.</p>
  <p class="actions"><a class="button" href="">Try again</a> <a href="/articles">Browse articles</a></p>
</main>
</body>
</html>`;

export { forward as GET, forward as HEAD, forward as POST, forward as PUT, forward as PATCH, forward as DELETE };
