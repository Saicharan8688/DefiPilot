"use client";

import { useState } from "react";
import { useWallet } from "./wallet-provider";
import { useDemoWallets } from "./demo-wallet-provider";
import { shortenAddress } from "@/lib/format";
import { cn } from "@/lib/utils";

function panelClasses() {
  return cn(
    "absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-xl",
    "border border-zinc-800 bg-zinc-900 shadow-2xl shadow-black/50"
  );
}

export function DemoWalletMenu() {
  const { address, isConnected, disconnect } = useWallet();
  const { wallets, select } = useDemoWallets();
  const [open, setOpen] = useState(false);

  const current = wallets.find((w) => w.address === address);
  const toggle = () => setOpen((o) => !o);

  if (isConnected && current) {
    return (
      <div className="relative">
        <button
          onClick={toggle}
          className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-100 transition-colors hover:bg-zinc-800"
          aria-expanded={open}
        >
          <span className="size-2 rounded-full bg-emerald-400" aria-hidden />
          {current.label}
          <span className="text-xs text-zinc-400">{shortenAddress(current.address)}</span>
        </button>
        {open && (
          <div className={panelClasses()}>
            <p className="border-b border-zinc-800 px-4 py-3 text-xs text-zinc-400">
              Demo wallet — simulated balances
            </p>
            {wallets.map((w) => (
              <button
                key={w.id}
                onClick={() => {
                  select(w.address);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors hover:bg-zinc-800",
                  w.address === address && "bg-zinc-800/60"
                )}
              >
                <span>
                  <span className="block font-medium text-zinc-100">{w.label}</span>
                  <span className="block text-xs text-zinc-400">{w.description}</span>
                </span>
                {w.address === address && (
                  <span className="text-xs text-emerald-400">Connected</span>
                )}
              </button>
            ))}
            <button
              onClick={() => {
                disconnect();
                setOpen(false);
              }}
              className="w-full border-t border-zinc-800 px-4 py-3 text-left text-sm text-red-300 transition-colors hover:bg-zinc-800"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={toggle}
        className="rounded-full bg-gradient-to-r from-emerald-400 to-cyan-500 px-5 py-2 text-sm font-semibold text-zinc-950 shadow-lg shadow-emerald-500/20 transition-transform hover:scale-[1.02]"
        aria-expanded={open}
      >
        Connect Wallet
      </button>
      {open && (
        <div className={panelClasses()}>
          <p className="border-b border-zinc-800 px-4 py-3 text-xs text-zinc-400">
            Choose a demo portfolio
          </p>
          {wallets.map((w) => (
            <button
              key={w.id}
              onClick={() => {
                select(w.address);
                setOpen(false);
              }}
              className="flex w-full flex-col gap-0.5 px-4 py-3 text-left transition-colors hover:bg-zinc-800"
            >
              <span className="text-sm font-medium text-zinc-100">{w.label}</span>
              <span className="text-xs text-zinc-400">{w.description}</span>
            </button>
          ))}
          <p className="border-t border-zinc-800 px-4 py-3 text-[11px] leading-relaxed text-zinc-500">
            Demo wallets use simulated balances. No funds at risk.
          </p>
        </div>
      )}
    </div>
  );
}