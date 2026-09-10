"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";
import type { Address } from "@/lib/types";
import { demoChainId, DEMO_WALLETS, type DemoWallet } from "@/lib/demo/wallets";
import { WalletProvider, type WalletContextValue } from "./wallet-provider";

const STORAGE_KEY = "defipilot.demo-wallet";
const STORAGE_EVENT = "defipilot:demo-wallet-changed";

const subscribe = (onStoreChange: () => void) => {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(STORAGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(STORAGE_EVENT, onStoreChange);
  };
};

const getSnapshot = () => window.localStorage.getItem(STORAGE_KEY);

const getServerSnapshot = () => null;

interface DemoWalletContextValue {
  wallets: DemoWallet[];
  selected: Address | null;
  select: (addr: Address) => void;
  clear: () => void;
}

const DemoWalletContext = createContext<DemoWalletContextValue | null>(null);

export function DemoWalletProvider({ children }: { children: ReactNode }) {
  // External store (localStorage) keeps SSR/hydration consistent and avoids
  // setState-in-effect cascading renders.
  const saved = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const selected =
    saved && DEMO_WALLETS.some((w) => w.address === saved)
      ? (saved as Address)
      : null;

  const select = useCallback((address: Address) => {
    window.localStorage.setItem(STORAGE_KEY, address);
    window.dispatchEvent(new Event(STORAGE_EVENT));
  }, []);

  const clear = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(STORAGE_EVENT));
  }, []);

  const contextValue = useMemo<DemoWalletContextValue>(
    () => ({ wallets: DEMO_WALLETS, selected, select, clear }),
    [selected, select, clear]
  );

  const walletValue = useMemo<WalletContextValue>(
    () => ({
      address: selected,
      isConnected: selected !== null,
      isDemo: true,
      chainId: demoChainId,
      connect: () => select(DEMO_WALLETS[0].address),
      disconnect: clear,
    }),
    [selected, select, clear]
  );

  return (
    <DemoWalletContext.Provider value={contextValue}>
      <WalletProvider value={walletValue}>{children}</WalletProvider>
    </DemoWalletContext.Provider>
  );
}

export function useDemoWallets(): DemoWalletContextValue {
  const ctx = useContext(DemoWalletContext);
  if (!ctx) {
    throw new Error("useDemoWallets must be used within a DemoWalletProvider");
  }
  return ctx;
}