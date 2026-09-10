"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { mainnet, sepolia } from "wagmi/chains";
import { demoMode, walletConnectProjectId } from "@/lib/config";
import { DemoWalletProvider } from "@/components/wallet/demo-wallet-provider";
import { RealWalletBridge } from "@/components/wallet/real-wallet-bridge";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 2,
            refetchOnWindowFocus: false,
            staleTime: 30_000,
          },
        },
      })
  );

  // Only build the wagmi config when a WalletConnect project ID is present.
  // Without one the app runs in demo mode (no external wallet dependencies).
  const [wagmiConfig] = useState(() => {
    if (demoMode) return null;
    return getDefaultConfig({
      appName: "DeFiPilot",
      projectId: walletConnectProjectId,
      chains: [mainnet, sepolia],
      ssr: true,
    });
  });

  if (demoMode || !wagmiConfig) {
    return (
      <QueryClientProvider client={queryClient}>
        <DemoWalletProvider>{children}</DemoWalletProvider>
      </QueryClientProvider>
    );
  }

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider modalSize="compact">
          <RealWalletBridge>{children}</RealWalletBridge>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}