# Acme News: phased migration from PHP to Next.js

A small slice of a strangler-fig migration. A legacy PHP app stays the system of record for articles. A Next.js app sits in front of it, renders the articles that have been migrated, and transparently serves everything else from PHP under the same URLs.

```
legacy-php/   the legacy app: JSON API + legacy HTML pages (no database)
next-app/     the new Next.js 16 + TypeScript app
dev.sh        runs both side by side
SOLUTION.md   design decisions and trade-offs
```

## Run it

Requirements: **Node.js 22.18+** (the unit tests use Node's built-in TypeScript support), and **PHP 8+** or Docker. `dev.sh` uses Docker automatically when PHP is missing; the first run pulls a ~540MB PHP image.

```bash
./dev.sh
```

Then open **http://localhost:3009**. Use `localhost`, not `127.0.0.1`: Next.js blocks its dev resources on other hostnames.

`dev.sh` installs dependencies on first run and starts:

- legacy PHP on `127.0.0.1:8000`
- Next.js on port 3009 (`PORT=3100 ./dev.sh` to change it)

Or run them in two terminals:

```bash
php -S 127.0.0.1:8000 legacy-php/index.php
cd next-app && npm install && npm run dev -- -p 3009
```

## Things to try

| URL | Served by | What it shows |
| --- | --- | --- |
| `/articles` | Next.js | All five legacy articles through the normalized model |
| `/articles/a-field-guide-to-legacy-data` | Next.js | The messiest legacy record, rendered cleanly |
| `/articles/caching-without-tears?utm_source=newsletter` | Legacy PHP | Same URL, query string intact (see the page footer) |
| `/about` | Legacy PHP | A page Next.js doesn't have yet falls through to legacy |
| `/articles/does-not-exist` | Legacy PHP | Legacy's own 404 |

Every article response carries an `x-served-by` header (`next` or `legacy-php`):

```bash
curl -sI 'localhost:3009/articles/caching-without-tears?ref=x' | grep x-served-by
```

The raw legacy data is at `http://127.0.0.1:8000/api/articles`.

### Simulate a slow or broken legacy app

```bash
LEGACY_DELAY_MS=2000 ./dev.sh   # slow: loading skeletons
LEGACY_DELAY_MS=6000 ./dev.sh   # slower than the 3s timeout: error page with retry
LEGACY_DOWN=1 ./dev.sh          # legacy returns 503
```

With legacy down, migrated pages keep serving their last good copy. Pages still on legacy show a branded "temporarily unavailable" page, since only PHP can render them.

Caching hides a slow legacy app after the first load. To see the states again, restart or wait for the cache to expire.

### Migrate or roll back a page

The migrated set lives in `next-app/src/lib/migration.ts`. `MIGRATED_SLUGS` overrides it at runtime, with no rebuild:

```bash
MIGRATED_SLUGS=why-we-are-moving-to-nextjs,caching-without-tears ./dev.sh
```

## Configuration (`next-app`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `LEGACY_ORIGIN` | `http://127.0.0.1:8000` | Where the legacy app lives |
| `MIGRATED_SLUGS` | two slugs in `migration.ts` | Comma-separated override of the migrated set |
| `SITE_URL` | `http://localhost:3000` | Base for canonical and Open Graph URLs |

## Tests

```bash
cd next-app
npm test          # unit tests for the normalizer (node:test, no extra deps)
npm run test:e2e  # Playwright: boots PHP + a production build, tests routing and outages
npm run lint && npm run typecheck
```

The end-to-end suite uses ports 8000, 3100 and 3101. On first run, install the browser with `npx playwright install chromium`. CI (`.github/workflows/ci.yml`) runs all of the above.

## Production build

```bash
cd next-app && npm run build && npm start
```

`next build` prerenders articles from the legacy API, so **legacy PHP must be running during the build**. See SOLUTION.md for why.
