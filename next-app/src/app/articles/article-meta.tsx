import type { Article } from "@/lib/article";

const longDate = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" });

export function ArticleMeta({ article }: { article: Article }) {
  return (
    <p className="mt-2 text-sm text-muted">
      {article.author ?? "Acme News staff"}
      {" · "}
      {article.publishedAt ? (
        <time dateTime={article.publishedAt}>{longDate.format(new Date(article.publishedAt))}</time>
      ) : (
        "Undated"
      )}
    </p>
  );
}

export function Tags({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-2" aria-label="Tags">
      {tags.map((tag) => (
        <li key={tag} className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted">
          {tag}
        </li>
      ))}
    </ul>
  );
}
