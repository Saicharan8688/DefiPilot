"use client";

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-red-900/50 bg-red-950/20 p-6 text-center">
      <p className="font-medium text-red-300">{title}</p>
      {message && <p className="mt-1 text-sm text-red-200/70">{message}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-800"
        >
          Try again
        </button>
      )}
    </div>
  );
}