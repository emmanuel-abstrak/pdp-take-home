import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getArticle } from "@/lib/legacy";
import { isMigrated, migratedSlugs } from "@/lib/migration";
import { ArticleMeta, Tags } from "../article-meta";

export function generateStaticParams() {
  return migratedSlugs.map((slug) => ({ slug }));
}

async function loadArticle(params: PageProps<"/articles/[slug]">["params"]) {
  const { slug } = await params;
  const article = isMigrated(slug) ? await getArticle(slug) : null;
  if (!article) notFound();
  return article;
}

export async function generateMetadata({ params }: PageProps<"/articles/[slug]">): Promise<Metadata> {
  const article = await loadArticle(params);
  return {
    title: article.title,
    description: article.summary || undefined,
    alternates: { canonical: `/articles/${article.slug}` },
    openGraph: {
      type: "article",
      title: article.title,
      description: article.summary || undefined,
      publishedTime: article.publishedAt ?? undefined,
      authors: article.author ? [article.author] : undefined,
      tags: article.tags,
    },
  };
}

export default async function ArticlePage({ params }: PageProps<"/articles/[slug]">) {
  const article = await loadArticle(params);

  return (
    <article>
      <Link href="/articles" className="text-sm text-muted hover:text-foreground">
        &larr; All articles
      </Link>
      <h1 className="mt-6 text-4xl font-bold tracking-tight text-balance">{article.title}</h1>
      <ArticleMeta article={article} />
      <Tags tags={article.tags} />
      <div className="mt-10 space-y-6 text-lg leading-relaxed">
        {article.body.map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>
    </article>
  );
}
