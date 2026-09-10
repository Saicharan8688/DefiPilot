import type { Address } from "@/lib/types";

export const demoChainId = 1;

export type DemoWalletStyle = "conservative" | "balanced" | "growth";

export interface DemoWallet {
  id: string;
  label: string;
  style: DemoWalletStyle;
  description: string;
  address: Address;
}

export const DEMO_WALLETS: DemoWallet[] = [
  {
    id: "conservative",
    label: "Portfolio A",
    style: "conservative",
    description: "Mostly stablecoins — ideal for lending yield.",
    address: "0xdcf1a13b2a5e2c4f9a8e7d1c3b5f9a7e1c3d5b2a",
  },
  {
    id: "balanced",
    label: "Portfolio B",
    style: "balanced",
    description: "A mix of ETH and stablecoins.",
    address: "0x7b2c9d4e1a5f8c3b6d2e9f1a4c7b8d5e2f3a6b1c",
  },
  {
    id: "growth",
    label: "Portfolio C",
    style: "growth",
    description: "Dominated by ETH and volatile assets.",
    address: "0x9a1f6c2d4b8e5f7a3c9d2b1e4f6a8c5d7b3f2a1e",
  },
];

export function findDemoWallet(address: Address): DemoWallet | undefined {
  return DEMO_WALLETS.find((w) => w.address === address);
}