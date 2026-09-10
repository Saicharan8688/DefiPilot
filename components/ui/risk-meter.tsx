export function RiskMeter({ score }: { score: number }) {
  const clamped = Math.min(99, Math.max(0, score));
  const pct = (clamped / 99) * 100;

  return (
    <div className="w-full max-w-md">
      <div className="relative h-2 w-full rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-red-500">
        <span
          className="absolute -top-1 size-4 -translate-x-1/2 rounded-full border-2 border-zinc-900 bg-white shadow-md"
          style={{ left: `${pct}%` }}
          aria-hidden
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-wider text-zinc-500">
        <span>Low risk</span>
        <span className="text-zinc-300">
          score <span className="font-semibold">{score}</span>/99
        </span>
        <span>High risk</span>
      </div>
    </div>
  );
}