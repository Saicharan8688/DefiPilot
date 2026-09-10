"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="grid min-h-[60vh] place-items-center p-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-zinc-100">Something went wrong</h2>
        <p className="mt-2 text-sm text-zinc-400">
          An unexpected error occurred while rendering this page. Please try again.
        </p>
        <button
          onClick={reset}
          className="mt-6 rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-800"
        >
          Try again
        </button>
      </div>
    </div>
  );
}