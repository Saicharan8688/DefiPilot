"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { Address } from "@/lib/types";

export interface WalletContextValue {
  address: Address | null;
  isConnected: boolean;
  isDemo: boolean;
  chainId: number;
  connect: () => void;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({
  value,
  children,
}: {
  value: WalletContextValue;
  children: ReactNode;
}) {
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return ctx;
}