/**
 * Chain metadata + RPC endpoints for the blockchain layer.
 * All RPC reads are read-only: the app never signs or broadcasts.
 */
export interface ChainDescriptor {
  network: string;
  chainId: number;
  isTestnet: boolean;
  currency: string;
  rpcUrl?: string;
  explorer?: string;
}

export const DEFAULT_CHAIN_ID = 1;

const CHAINS: Record<number, ChainDescriptor> = {
  1: {
    network: "Ethereum Mainnet",
    chainId: 1,
    isTestnet: false,
    currency: "ETH",
    rpcUrl: process.env.RPC_URL ?? "https://ethereum.publicnode.com",
    explorer: "https://etherscan.io",
  },
  11155111: {
    network: "Sepolia",
    chainId: 11155111,
    isTestnet: true,
    currency: "ETH",
    rpcUrl: process.env.TESTNET_RPC_URL ?? "https://ethereum-sepolia.publicnode.com",
    explorer: "https://sepolia.etherscan.io",
  },
  8453: {
    network: "Base",
    chainId: 8453,
    isTestnet: false,
    currency: "ETH",
    rpcUrl: "https://mainnet.base.org",
    explorer: "https://basescan.org",
  },
  84532: {
    network: "Base Sepolia",
    chainId: 84532,
    isTestnet: true,
    currency: "ETH",
    rpcUrl: process.env.TESTNET_RPC_URL ?? "https://sepolia.base.org",
    explorer: "https://sepolia.basescan.org",
  },
  42161: {
    network: "Arbitrum One",
    chainId: 42161,
    isTestnet: false,
    currency: "ETH",
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    explorer: "https://arbiscan.io",
  },
  10: {
    network: "OP Mainnet",
    chainId: 10,
    isTestnet: false,
    currency: "ETH",
    rpcUrl: "https://mainnet.optimism.io",
    explorer: "https://optimistic.etherscan.io",
  },
};

export function getChain(chainId: number | null | undefined): ChainDescriptor | null {
  if (chainId && CHAINS[chainId]) return CHAINS[chainId];
  return null;
}

export function listChains(): ChainDescriptor[] {
  return Object.values(CHAINS);
}