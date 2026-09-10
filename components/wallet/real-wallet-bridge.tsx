"use client";

import type { ReactNode } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { WalletProvider, type WalletContextValue } from "./wallet-provider";

export function RealWalletBridge({ children }: { children: ReactNode }) {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  const value: WalletContextValue = {
    address: address ?? null,
    isConnected,
    isDemo: false,
    chainId: chainId ?? 1,
    connect: () => {
      const connector =
        connectors.find((c) => c.type === "injected") ?? connectors[0];
      if (connector) connect({ connector });
    },
    disconnect: () => disconnect(),
  };

  return <WalletProvider value={value}>{children}</WalletProvider>;
}