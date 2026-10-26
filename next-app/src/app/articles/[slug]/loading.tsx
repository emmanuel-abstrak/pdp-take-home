export default function Loading() {
  return (
    <div role="status" aria-busy="true" className="animate-pulse">
      <span className="sr-only">Loading article…</span>
      <div className="h-4 w-24 rounded bg-border" />
      <div className="mt-6 h-10 w-4/5 rounded bg-border" />
      <div className="mt-3 h-4 w-1/3 rounded bg-border" />
      <div className="mt-10 space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-5 w-full rounded bg-border" />
        ))}
        <div className="h-5 w-2/3 rounded bg-border" />
      </div>
    </div>
  );
}
