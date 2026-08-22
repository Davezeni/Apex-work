export default function WalletLoading() {
  return (
    <div className="min-h-dvh bg-background pb-16">
      <div className="safe-top border-b border-border bg-background/95 px-3 py-3">
        <div className="h-6 w-24 animate-pulse rounded bg-muted" />
      </div>
      <div className="mx-4 mt-4 h-44 animate-pulse rounded-3xl bg-muted" />
      <div className="mx-4 mt-6 space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-muted/70" />
        ))}
      </div>
    </div>
  );
}
