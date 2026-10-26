export type Article = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string[];
  author: string | null;
  publishedAt: string | null;
  tags: string[];
  featured: boolean;
};

type LegacyRecord = Record<string, unknown>;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export function isValidSlug(value: string): boolean {
  return SLUG.test(value);
}

export function normalizeArticle(input: unknown): Article | null {
  if (typeof input !== "object" || input === null) return null;
  const raw = input as LegacyRecord;

  const id = text(raw, "id", "article_id", "ID");
  const slug = text(raw, "slug");
  const title = text(raw, "title", "headline");
  if (!id || !slug || !isValidSlug(slug) || !title) return null;
  if (raw.is_published !== undefined && !bool(raw.is_published)) return null;

  const body = (text(raw, "body", "content") ?? "")
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return {
    id,
    slug,
    title,
    summary: text(raw, "summary", "excerpt") ?? excerpt(body[0] ?? ""),
    body,
    author: text(raw, "author", "author_name"),
    publishedAt: parseLegacyDate(raw.published_at ?? raw.pub_date ?? raw.date),
    tags: parseTags(raw.tags),
    featured: bool(raw.is_featured),
  };
}

export function parseLegacyDate(value: unknown): string | null {
  const s = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  let m: RegExpMatchArray | null;
  let ms = NaN;

  if (/^\d{9,11}$/.test(s)) {
    ms = Number(s) * 1000;
  } else if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) {
    ms = Date.UTC(+m[3], +m[2] - 1, +m[1]);
  } else if ((m = s.match(/^([a-z]{3})[a-z]* (\d{1,2}), (\d{4})$/i))) {
    const month = MONTHS.indexOf(m[1].toLowerCase());
    if (month >= 0) ms = Date.UTC(+m[3], month, +m[2]);
  } else if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(s)) {
    ms = Date.parse(s.replace(" ", "T") + "Z");
  } else if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    ms = Date.parse(s);
  }

  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

export function parseTags(value: unknown): string[] {
  const list = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  return [...new Set(list.map((t) => String(t).trim().toLowerCase()).filter(Boolean))];
}

function text(raw: LegacyRecord, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = raw[key];
    if ((typeof value === "string" || typeof value === "number") && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return null;
}

function bool(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

function excerpt(paragraph: string, max = 160): string {
  if (paragraph.length <= max) return paragraph;
  return paragraph.slice(0, paragraph.lastIndexOf(" ", max)) + "…";
}
