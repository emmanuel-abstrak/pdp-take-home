import Link from "next/link";

export default function NotFound() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 text-muted">The page you&rsquo;re looking for doesn&rsquo;t exist or has moved.</p>
      <Link href="/articles" className="mt-6 inline-block underline underline-offset-4">
        Browse all articles
      </Link>
    </div>
  );
}
