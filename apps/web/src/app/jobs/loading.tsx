export default function JobsLoading() {
  return (
    <div className="min-h-dvh bg-background pb-24">
      <div className="safe-top border-b border-border bg-background/95 px-4 py-3">
        <div className="h-6 w-24 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-3 w-40 animate-pulse rounded bg-muted/60" />
        <div className="mt-3 h-9 w-full animate-pulse rounded-full bg-muted" />
      </div>
      <div className="mx-3 mt-4 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex gap-3">
              <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                <div className="h-4 w-full animate-pulse rounded bg-muted/70" />
                <div className="h-4 w-2/3 animate-pulse rounded bg-muted/70" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
