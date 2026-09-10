"use client";

import { useWallet } from "@/components/wallet/wallet-provider";
import { PortfolioView } from "@/components/portfolio/portfolio-view";

export function PortfolioSection() {
  const { isConnected } = useWallet();

  if (!isConnected) return null;

  return (
    <section id="portfolio" className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-widest text-zinc-500">
          Your wallet · on-chain
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">
          Portfolio analysis
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          A quick read of what your wallet is holding right now.
        </p>
      </div>
      <PortfolioView />
    </section>
  );
}