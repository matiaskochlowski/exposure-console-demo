export function QueueSkeleton() {
  return (
    <div
      className="flex flex-1 flex-col gap-2 px-4 py-6 sm:px-6"
      aria-busy="true"
      aria-label="Loading findings"
    >
      <span className="sr-only">Loading findings…</span>
      <div className="h-6 w-48 animate-pulse rounded bg-surface-2" />
      <div className="h-9 w-full max-w-md animate-pulse rounded bg-surface-2" />
      <div className="mt-2 flex flex-col gap-2 rounded-xl border border-line bg-surface p-3">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-12 animate-pulse rounded bg-surface-2" />
        ))}
      </div>
    </div>
  );
}
