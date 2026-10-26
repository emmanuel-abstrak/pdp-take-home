"use client";

export default function ArticlesError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <div role="alert">
      <h1 className="text-2xl font-semibold tracking-tight">Articles are temporarily unavailable</h1>
      <p className="mt-2 text-muted">We couldn&rsquo;t reach the article service. This is usually brief.</p>
      <button
        type="button"
        onClick={retry}
        className="mt-6 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Try again
      </button>
    </div>
  );
}
