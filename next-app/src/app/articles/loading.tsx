export default function Loading() {
  return (
    <div role="status" aria-busy="true" className="animate-pulse">
      <span className="sr-only">Loading articles…</span>
      <div className="h-9 w-40 rounded bg-border" />
      <ul className="mt-6 divide-y divide-border">
        {[0, 1, 2].map((i) => (
          <li key={i} className="space-y-3 py-6">
            <div className="h-6 w-3/4 rounded bg-border" />
            <div className="h-4 w-1/3 rounded bg-border" />
            <div className="h-4 w-full rounded bg-border" />
          </li>
        ))}
      </ul>
    </div>
  );
}
