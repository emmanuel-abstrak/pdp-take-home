import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeArticle, parseLegacyDate, parseTags } from "./article.ts";

process.env.TZ = "Africa/Johannesburg";

test("normalizes aliased fields, string ids, int-ish booleans and messy tags", () => {
  const article = normalizeArticle({
    article_id: "2",
    slug: "a-field-guide-to-legacy-data",
    headline: "A field guide",
    content: "First paragraph.\r\n\r\nSecond paragraph.",
    author_name: "Pieter",
    pub_date: "15/02/2024",
    is_published: "1",
    is_featured: "1",
    tags: "php, legacy ,migration, PHP",
  });

  assert.deepEqual(article, {
    id: "2",
    slug: "a-field-guide-to-legacy-data",
    title: "A field guide",
    summary: "First paragraph.",
    body: ["First paragraph.", "Second paragraph."],
    author: "Pieter",
    publishedAt: "2024-02-15T00:00:00.000Z",
    tags: ["php", "legacy", "migration"],
    featured: true,
  });
});

test("fills missing values with safe defaults", () => {
  const article = normalizeArticle({ ID: 5, slug: "x", title: "X", author: "  ", summary: null, is_featured: 0 });
  assert.equal(article?.id, "5");
  assert.equal(article?.author, null);
  assert.equal(article?.summary, "");
  assert.deepEqual(article?.body, []);
  assert.deepEqual(article?.tags, []);
  assert.equal(article?.publishedAt, null);
  assert.equal(article?.featured, false);
});

test("derives a summary from the body when none is provided", () => {
  const long = "word ".repeat(60).trim();
  const article = normalizeArticle({ id: 1, slug: "x", title: "X", body: long });
  assert.ok(article!.summary.endsWith("…"));
  assert.ok(article!.summary.length <= 161);
});

test("rejects records that cannot be routed or should not be shown", () => {
  assert.equal(normalizeArticle(null), null);
  assert.equal(normalizeArticle("nope"), null);
  assert.equal(normalizeArticle({ id: 1, title: "No slug" }), null);
  assert.equal(normalizeArticle({ id: 1, slug: "Bad Slug!", title: "X" }), null);
  assert.equal(normalizeArticle({ slug: "no-id", title: "X" }), null);
  assert.equal(normalizeArticle({ id: 1, slug: "draft", title: "X", is_published: 0 }), null);
});

test("parses every legacy date format as UTC", () => {
  assert.equal(parseLegacyDate("2024-01-15T09:30:00Z"), "2024-01-15T09:30:00.000Z");
  assert.equal(parseLegacyDate("2024-01-15T11:30:00+02:00"), "2024-01-15T09:30:00.000Z");
  assert.equal(parseLegacyDate("15/02/2024"), "2024-02-15T00:00:00.000Z");
  assert.equal(parseLegacyDate(1710496800), "2024-03-15T10:00:00.000Z");
  assert.equal(parseLegacyDate("1710496800"), "2024-03-15T10:00:00.000Z");
  assert.equal(parseLegacyDate("2024-04-02 14:00:00"), "2024-04-02T14:00:00.000Z");
  assert.equal(parseLegacyDate("May 5, 2024"), "2024-05-05T00:00:00.000Z");
  assert.equal(parseLegacyDate("September 9, 2024"), "2024-09-09T00:00:00.000Z");
});

test("returns null for unparseable dates instead of Invalid Date", () => {
  for (const value of [undefined, null, "", "yesterday", "Foo 5, 2024", {}]) {
    assert.equal(parseLegacyDate(value), null);
  }
});

test("accepts tags as CSV or array and drops blanks and duplicates", () => {
  assert.deepEqual(parseTags("operations,on-call,"), ["operations", "on-call"]);
  assert.deepEqual(parseTags(["A", " a ", "b"]), ["a", "b"]);
  assert.deepEqual(parseTags(""), []);
  assert.deepEqual(parseTags(undefined), []);
});
