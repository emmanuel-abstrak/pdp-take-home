# Solution: design and trade-offs

## The shape of it

```
browser ─► Next.js (the front door)
             │
             ├─ proxy.ts, on /articles/:slug
             │    ├─ malformed slug ──► 404, never forwarded
             │    ├─ migrated slug ───► Next.js page ──► getArticle() ──► legacy JSON API
             │    │                                      normalizeArticle() turns it into an Article
             │    └─ any other slug ──► internal rewrite ──┐
             │                                             │
             └─ fallback rewrite, on any route Next.js lacks ┤
                                                           ▼
                              /legacy forwarder ──► legacy PHP page, same URL + query
                                                    PHP down: a branded 503 page instead
```

Legacy PHP stays the **only** store of article content. Next.js never copies it. It reads the legacy JSON API, converts each record to one typed `Article` model, and renders only the slugs that have been migrated. Every other URL keeps being answered by PHP, unchanged, through one small forwarder on the same origin. Each URL is served by exactly one app at any time.

## Task 1: the legacy app

Two files, no framework, no database. `articles.php` is a fixed array with drift built in on purpose:

- `id` / `article_id` / `ID`, sometimes as strings
- `title` / `headline`, `body` / `content`, `author` / `author_name`, `summary` / `excerpt`
- dates as ISO 8601, `DD/MM/YYYY`, a unix timestamp, MySQL `DATETIME`, and `"May 5, 2024"`
- booleans as `1`, `"1"`, `0`, `"0"`
- tags as CSV with stray spaces, duplicate casing, trailing commas, empty strings or no field at all
- blank or null values, and Windows line endings in one body

`index.php` is a router for PHP's built-in server. It serves the JSON API as stored, plus legacy HTML pages that read the same messy fields "the legacy way". Articles are addressed by **slug**, the stable identifier the existing URLs are already built from. The ids drift in name and type, so they're carried through but never used for routing. The HTML footer prints the host and query string it received, so URL preservation is visible on screen. `LEGACY_DELAY_MS` and `LEGACY_DOWN` simulate a slow or failing upstream.

## Task 2: the Next.js app

### One translation boundary

`src/lib/article.ts` is the only code that knows what legacy records look like. `normalizeArticle(input: unknown): Article | null` takes `unknown` on purpose: this is a trust boundary, and the compiler should force every field to be checked.

Decisions inside it:

- **Field aliases** are resolved in one helper: the first non-blank string or number wins.
- **Dates** are parsed against the explicit formats seen in the data and treated as UTC, because the legacy server ran on UTC. Anything unrecognised becomes `null` and renders as "Undated" instead of "Invalid Date". I deliberately avoided `Date.parse` on free-form strings: its result depends on the server's timezone. The tests run in a non-UTC timezone to prove that.
- **`DD/MM/YYYY` is an assumption.** The CMS was configured for a day-first locale, so `15/02/2024` is unambiguous here. In a real migration I'd confirm this against the CMS settings before trusting it.
- **Bad records are dropped, not fatal.** A record without a usable id, slug or title, or with `is_published = 0`, is left out and logged as a structured `legacy_record_dropped` event. One corrupt row shouldn't take down the listing.
- **Body text is plain paragraphs** rendered by React, so it is escaped and legacy content can't inject markup. If legacy bodies contained HTML, I'd add a sanitizer at this boundary.
- **No Zod.** A schema library would mostly encode aliases and coercions, which are clearer as about 100 lines of plain TypeScript with a test per quirk. At ten legacy entities instead of one, I'd revisit that.

### Data access, caching and failure behaviour

`src/lib/legacy.ts` holds two functions, `getArticles()` and `getArticle(slug)`. Both use Next 16's `'use cache'` with `cacheLife('minutes')`.

| Situation | What the reader gets |
| --- | --- |
| Normal | Prerendered HTML. Data refreshes in the background at most once a minute. |
| Legacy slow | Cached pages are unaffected. On a cache miss, a loading skeleton streams first. |
| Legacy hangs | Requests are aborted after **3s**, then the next two rows apply. |
| Legacy down, page cached | The **last good copy** keeps being served. A failed background refresh doesn't replace it (verified: the server logs the failed revalidation and the page stays 200). |
| Legacy down, nothing cached | `error.tsx`: "Articles are temporarily unavailable" with a **Try again** button (`retry()` re-fetches). |
| Unknown article | Legacy's own 404 page (see Task 3). |

Trade-offs:

- **Freshness vs. availability.** Editorial content can be a minute stale without anyone noticing; an error page is very noticeable. One minute is a guess, set in one place. Next step: `cacheTag` per article plus a revalidation webhook the legacy CMS calls on publish, so edits appear immediately and the time-based window could grow.
- **The build depends on legacy.** Migrated pages and the list are prerendered, so `next build` needs the legacy API reachable. I accept this: deploys run where the API is available, and a failing build is safer than shipping empty pages. It's also why CI starts PHP before building.
- **The cache is per instance.** `'use cache'` defaults to an in-memory LRU. That suits one server. With several instances or serverless, `'use cache: remote'` with a shared store would stop each instance from hitting legacy separately.
- **Timeout errors are wrapped.** A timed-out `fetch` rejects with a `DOMException` whose `message` is read-only. Next's error reporting tries to rewrite that message and logs unhandled rejections of its own. The fetch is re-thrown as a plain `Error("Legacy /path unreachable", { cause })`, which also makes logs easier to read.

### Rendering and UX

- Server Components throughout. The only client component is the error boundary, so the browser downloads very little JavaScript.
- Skeletons match the final layout and use `role="status"` with screen-reader text.
- `generateMetadata` provides the title, description (summary, or derived from the body), Open Graph article fields and a canonical URL.

## Task 3: page-by-page migration

### Two levels of fallback

1. **Article level: `src/proxy.ts`** (Next 16's renamed middleware), matched on `/articles/:slug`:
   - malformed slug: 404 straight from the proxy;
   - migrated slug: let Next.js render it;
   - otherwise: an internal rewrite to the forwarder (3).

   It is a **rewrite, not a redirect**, so the browser URL never changes, bookmarks and search rankings stay intact, and the reader can't tell which app answered. An `x-served-by` header makes it visible to us.
2. **Route level: a `fallback` rewrite** in `next.config.ts`. Any URL Next.js has no route for (`/about`, old `.php` URLs, legacy assets) also goes to the forwarder. Next.js only answers what it explicitly owns, so a link is never broken just because it hasn't been migrated.
3. **The forwarder: `src/app/legacy/[...path]/route.ts`.** Both levels end here. It sends the reader's exact path and query string to PHP and streams back the status, headers, cookies and body. A redirect pointing at the legacy origin is made relative, and internal headers (`Host`, `X-Powered-By`) are dropped. If PHP is unreachable, takes more than 10s, or answers 502/503/504, the reader gets a branded "temporarily unavailable" page with a `503` and `Retry-After`, not a raw error. Requests made directly to `/legacy/...` get a 404 from the proxy, so a legacy page never gains a second URL.

   **Why not Next's built-in rewrite to the PHP URL?** I started with it. When PHP was down it answered with a plain-text "Internal Server Error" that no app code can change, and it exposed the legacy address in an `x-middleware-rewrite` response header. Owning the forwarder fixes both, for about 80 lines, half of them the outage page.

### Where "migrated" is decided

`src/lib/migration.ts` lists the migrated slugs. The proxy, the list page and `generateStaticParams` all read it, so there is one source of truth.

- **In code by default:** migrating a page is a one-line, reviewable, revertible PR.
- **`MIGRATED_SLUGS` env override:** a rollback switch that needs a restart, not a code change or rebuild.
- **Rejected: a flag in the legacy data, or legacy 301s for migrated pages.** Either would put migration state in both apps, and they would drift.

**Rollback runbook:** if a migrated page misbehaves, set `MIGRATED_SLUGS` to the list without that slug and restart. The proxy sends the slug back to legacy immediately. Verify with `curl -sI <url> | grep x-served-by`. The list page's link style catches up on its next background refresh; until then a stale `<Link>` still works, with extra round trips.

Caveat: with Cache Components, `generateStaticParams` must return at least one slug, so `MIGRATED_SLUGS=""` works as a runtime switch but not at build time.

### Avoiding duplicate content

- **Content:** never copied. Next.js renders from the legacy API, so there is nothing to keep in sync.
- **URLs:** each path is answered by exactly one app. The article page also refuses (404s) any slug that isn't migrated, in case the proxy is ever bypassed.
- **Canonical:** every Next.js page declares its canonical URL. Legacy's own copy of a migrated page is still reachable directly on the PHP origin, which in production would be private behind the front door.

### A measured detail: `<Link>` vs `<a>`

The list links migrated articles with `<Link>` and legacy articles with a plain `<a>`. I checked the alternative in a real browser. With `<Link>` to a legacy slug, every list view prefetches each legacy page through the proxy, and PHP renders full HTML that nobody sees. Each click then makes an RSC request that gets HTML back, followed by a full reload: **3 legacy renders per click instead of 1**. Those requests would also inflate the `legacy_fallback` log, which is the metric for what still needs migrating.

### Input safety

Only **validated** slugs reach the forwarder at article level. Without that check, `/articles/%2e%2e` would resolve to a different legacy path once URL-normalised. Malformed slugs are answered in the proxy because a `notFound()` inside a streamed, partially prerendered page arrives after a `200` status has already been sent (a "soft 404").

The forwarder appends the request path to the fixed legacy origin as a string, so no path can change which host is called. `new URL("//evil.example", origin)` would.

### Observability

Each request the forwarder handles logs one JSON line, `{"event":"legacy_fallback","path":...}`, for article and route-level fallbacks alike. Aggregated, that's a ranked list of legacy pages still getting traffic, which is the migration backlog in priority order. Outages log `legacy_unavailable` with the path and reason.

## Known limitations

- **We maintain the forwarding.** The forwarder handles headers, cookies, redirects and streaming itself. It asks PHP for uncompressed responses and lets Next.js compress them. Request bodies are buffered, which suits forms but not large uploads, and websockets aren't forwarded.
- **Unmigrated pages share legacy's availability.** When PHP is down they can't be served, because Next.js doesn't own them. Readers get the branded 503 page within 10s rather than a raw error.
- **Only GET flows are tested.** POST is forwarded and returns the legacy page, but legacy forms, cookies and sessions aren't modelled or covered by tests in this slice.
- **Slug format is strict.** It follows the CMS slug format (`lowercase-with-hyphens`). If production has older slugs outside it, the pattern needs widening; the e2e suite would catch a regression.

## Testing

- **Unit (`node:test`, no extra dependencies):** one case per legacy quirk in the normalizer, run in a non-UTC timezone.
- **End-to-end (Playwright):** boots PHP, a production build in front of it, and a second instance whose legacy upstream is unreachable. Covers:
  - normalized listing
  - Next.js vs legacy serving
  - URL and query preservation, the forwarded host, and no legacy address in response headers
  - route-level fallback
  - 404 handling, malformed slugs, and the blocked internal route
  - client-side vs full-page navigation
  - stale-if-down
  - the error UI for migrated pages, and the branded 503 page for unmigrated ones
- **CI:** PHP lint, ESLint, typecheck, unit and e2e on every push.

## With more time

1. On-demand revalidation: `cacheTag` per article plus a webhook from the legacy CMS on publish.
2. `'use cache: remote'` for multi-instance deployments.
3. Move the migration list to a flag service, with per-slug percentage rollouts.
4. Contract tests against the real legacy API, so schema drift fails CI rather than production.
5. A dashboard over `legacy_fallback` and `legacy_record_dropped` events.
6. A redirect map for slugs that change during migration.
