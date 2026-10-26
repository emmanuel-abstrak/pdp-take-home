import { cacheLife } from "next/cache";
import { normalizeArticle, type Article } from "./article";
import { LEGACY_ORIGIN } from "./migration";

const TIMEOUT_MS = 3000;

export async function getArticles(): Promise<Article[]> {
  "use cache";
  cacheLife("minutes");

  const data = await fetchLegacy("/api/articles");
  if (!Array.isArray(data)) throw new Error("Legacy /api/articles did not return a list");

  return data
    .flatMap((raw) => normalizeArticle(raw) ?? dropped(raw))
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
}

export async function getArticle(slug: string): Promise<Article | null> {
  "use cache";
  cacheLife("minutes");

  const data = await fetchLegacy(`/api/articles/${encodeURIComponent(slug)}`);
  return data === null ? null : normalizeArticle(data);
}

async function fetchLegacy(path: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(LEGACY_ORIGIN + path, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (cause) {
    throw new Error(`Legacy ${path} unreachable`, { cause });
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Legacy ${path} responded ${res.status}`);
  return res.json();
}

function dropped(raw: unknown): [] {
  console.warn(JSON.stringify({ event: "legacy_record_dropped", record: raw }));
  return [];
}
