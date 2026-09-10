export function OpportunitySkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60">
      <div className="grid grid-cols-[1.2fr_1fr_0.7fr_1fr_0.7fr_0.7fr] gap-x-4 border-b border-zinc-800 bg-zinc-900 px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
        <span>Protocol</span>
        <span>Asset</span>
        <span className="text-right">APY</span>
        <span className="text-right">TVL</span>
        <span>Chain</span>
        <span className="text-right">Risk</span>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="grid grid-cols-[1.2fr_1fr_0.7fr_1fr_0.7fr_0.7fr] items-center gap-x-4 border-b border-zinc-800/50 px-5 py-3 last:border-0"
        >
          <div className="h-4 w-24 animate-pulse rounded bg-zinc-800" />
          <div className="h-4 w-14 animate-pulse rounded bg-zinc-800" />
          <div className="h-4 w-12 animate-pulse rounded bg-zinc-800 ml-auto" />
          <div className="h-4 w-16 animate-pulse rounded bg-zinc-800 ml-auto" />
          <div className="h-4 w-12 animate-pulse rounded bg-zinc-800" />
          <div className="ml-auto h-5 w-14 animate-pulse rounded-full bg-zinc-800" />
        </div>
      ))}
    </div>
  );
}