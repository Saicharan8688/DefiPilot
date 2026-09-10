/**
 * Client-safe configuration.
 * Only `NEXT_PUBLIC_*` variables are read here so this module can be
 * imported from Client Components without leaking server secrets.
 */

export const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

/** When no WalletConnect project ID is configured we fall back to demo mode. */
export const demoMode = walletConnectProjectId.trim() === "";

export const defaultChainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 1);

export const isBrowser = typeof window !== "undefined";