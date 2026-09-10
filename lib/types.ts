export type Address = `0x${string}`;

export interface TokenBalance {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  /** Raw balance in base units (string to avoid precision loss). */
  balance: string;
  /** Human-readable token amount. */
  formattedBalance: number;
  /** USD price. Null when a live price could not be sourced. */
  priceUsd: number | null;
  usdValue: number;
}

export interface Portfolio {
  address: Address;
  tokens: TokenBalance[];
  totalUsdValue: number;
  /** "demo" = deterministic simulated data, "live" = real on-chain reads. */
  source: "demo" | "live";
  updatedAt: string;
}

export interface DeFiOpportunity {
  id: string;
  protocol: string;
  chain: string;
  asset: string;
  /** Annual percentage yield, percent. */
  apy: number;
  /** Total value locked, USD. */
  tvl: number;
  /** Risk score 0 (low) - 100 (high). */
  riskScore: number;
  riskLevel: "Low" | "Medium" | "High";
}

export interface OpportunitiesResponse {
  opportunities: DeFiOpportunity[];
  source: "live" | "demo";
  fromCache: boolean;
  updatedAt: string;
  count: number;
}

/** Snapshot of the wallet used by the agent, with computed portfolio metrics. */
export interface PortfolioSnapshot {
  address: Address;
  totalUsdValue: number;
  tokens: Array<{
    symbol: string;
    name: string;
    balance: number;
    priceUsd: number | null;
    usdValue: number;
    percentage: number;
  }>;
  /** Value held in stablecoins (deployable capital). */
  idleCashUsd: number;
  /** Concentration: share of the largest holding, 0-1. */
  concentration: number;
  /** Number of distinct assets held. */
  assetCount: number;
  /** "demo" = simulated balances, "live" = real on-chain reads. */
  source: "demo" | "live";
}

export interface RecommendedAllocationItem {
  opportunityId: string;
  protocol: string;
  asset: string;
  chain: string;
  /** Share of deployable capital, 0-100 (sums to 100). */
  percentage: number;
  amountUsd: number;
  apy: number;
  riskScore: number;
  riskLevel: RiskLevel;
  expectedYieldUsd: number;
}

export interface Recommendation {
  summary: string;
  currentPortfolio: PortfolioSnapshot;
  /** Shortlist of opportunities the agent actually analyzed. */
  opportunities: DeFiOpportunity[];
  recommendedAllocation: RecommendedAllocationItem[];
  expectedYield: {
    /** Total expected annual yield, USD. */
    totalUsd: number;
    /** Capital-weighted blended APY, percent. */
    blendedApy: number;
    perItemUsd: number[];
  };
  /** Overall risk of the recommended allocation. */
  riskLevel: RiskLevel;
  riskScore: number;
  reasoning: string[];
  warnings: string[];
  assumptions: string[];
  /** "llm" = tool-using LLM agent, "fallback" = deterministic planner. */
  engine: "llm" | "fallback";
  dataProvidedAt: string;
}

export interface SimulationAllocationInput {
  opportunityId: string;
  amountUsd: number;
}

export interface SimulationStep {
  opportunityId: string;
  protocol: string;
  asset: string;
  chain: string;
  amountUsd: number;
  apy: number;
  riskScore: number;
  riskLevel: RiskLevel;
  expectedYieldUsd: number;
}

export interface SimulationResult {
  steps: SimulationStep[];
  totalCapitalUsd: number;
  totalExpectedYieldUsd: number;
  blendedApy: number;
  riskScore: number;
  riskLevel: RiskLevel;
  /** Simulation is a preview only; nothing is executed or broadcast. */
  executed: false;
  disclaimer: string;
}

export type RiskLevel = "Low" | "Medium" | "High";

/* ------------------------------------------------------------------ */
/* Agent Q&A                                                           */
/* ------------------------------------------------------------------ */

export type AgentIntent =
  | "IDLE_CAPITAL"
  | "WHY_PROTOCOL"
  | "ALTERNATIVE_ALLOCATION"
  | "RISKIEST_OPTION"
  | "EXPECTED_YIELD"
  | "CONCENTRATION"
  | "GENERAL";

export type AgentSectionKey =
  | "portfolioInsight"
  | "opportunitiesFound"
  | "riskAnalysis"
  | "recommendedAction"
  | "whyRecommendation"
  | "expectedOutcome"
  | "risksWarnings";

export interface AgentAnswerSection {
  key: AgentSectionKey;
  heading: string;
  text: string;
  bullets?: Array<{ label: string; value: string }>;
  tone?: "default" | "success" | "warning" | "danger";
}

/** Deterministic, engineering-produced answer to a user question. */
export interface AgentAnswer {
  intent: AgentIntent;
  question: string;
  /** Always "deterministic": figures come from code over ground truth. */
  source: "deterministic";
  dataProvidedAt: string;
  sections: AgentAnswerSection[];
  followUps: string[];
  note: string;
}

/* ------------------------------------------------------------------ */
/* Blockchain layer                                                     */
/* ------------------------------------------------------------------ */

export interface ChainInfoResponse {
  network: string;
  chainId: number;
  isTestnet: boolean;
  currency: string;
  /** Latest block number, when the RPC could be read. */
  blockNumber: number | null;
  /** Current gas price in Gwei, when the RPC could be read. */
  gasPriceGwei: number | null;
  /** "live" = read from the chain via RPC; "simulated" = RPC unavailable. */
  rpc: "live" | "simulated";
  simulated: boolean;
  note?: string;
  updatedAt: string;
}

export interface TransactionPreviewStep {
  sequence: number;
  /** The type of on-chain operation this step represents. */
  type: "supply" | "deposit" | "withdraw" | "swap";
  protocol: string;
  asset: string;
  chain: string;
  amountUsd: number;
  apy: number;
  riskScore: number;
  riskLevel: RiskLevel;
  /** Estimated result of the operation, written by code (never the model). */
  estimatedResultUsd: string;
  expectedYieldUsd: number;
  /** Contract address is intentionally null — resolved only at execution time. */
  contractAddress: null;
}

export interface TransactionPreview {
  /** Explicit: an AI recommendation is a proposal, not an executed transaction. */
  summary: string;
  transactionType: string;
  walletAddress: Address;
  network: {
    name: string;
    chainId: number;
    isTestnet: boolean;
    simulated: boolean;
  };
  steps: TransactionPreviewStep[];
  totalAmountUsd: number;
  totalExpectedYieldUsd: number;
  approved: false;
  executed: false;
  warnings: string[];
  disclaimer: string;
}

export interface SimulatedReceipt {
  status: "prepared_not_broadcast";
  transactionType: string;
  walletAddress: Address;
  network: { name: string; chainId: number; isTestnet: boolean };
  steps: number;
  totalAmountUsd: number;
  totalExpectedYieldUsd: number;
  /** Sandbox-only identifier; NOT an on-chain transaction hash. */
  sandboxRef: string;
  warnings: string[];
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: ApiError };