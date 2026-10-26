import type { Metadata } from "next";
import Link from "next/link";
import { getArticles } from "@/lib/legacy";
import { isMigrated } from "@/lib/migration";
import { ArticleMeta, Tags } from "./article-meta";

export const metadata: Metadata = {
  title: "Articles",
  alternates: { canonical: "/articles" },
};

export default async function ArticlesPage() {
  const articles = await getArticles();

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Articles</h1>
      {articles.length === 0 ? (
        <p className="mt-8 text-muted">No articles have been published yet.</p>
      ) : (
        <ul className="mt-6 divide-y divide-border">
          {articles.map((article) => (
            <li key={article.id} className="py-6">
              {article.featured && (
                <p className="mb-2 inline-block rounded bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">
                  Featured
                </p>
              )}
              <h2 className="text-xl font-semibold tracking-tight">
                <ArticleLink slug={article.slug}>{article.title}</ArticleLink>
              </h2>
              <ArticleMeta article={article} />
              {article.summary && <p className="mt-3 text-muted">{article.summary}</p>}
              <Tags tags={article.tags} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function ArticleLink({ slug, children }: { slug: string; children: React.ReactNode }) {
  const href = `/articles/${slug}`;
  const className = "hover:underline underline-offset-4";
  return isMigrated(slug) ? (
    <Link href={href} prefetch className={className}>
      {children}
    </Link>
  ) : (
    <a href={href} className={className}>
      {children}
    </a>
  );
}
