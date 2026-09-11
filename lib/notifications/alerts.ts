/**
 * Yield change detection and notification dispatch.
 * Compares current pool APYs against last-known values to detect
 * significant changes, then sends Telegram alerts to subscribers.
 */
import { getOpportunities } from "@/lib/defi/defillama";
import { sendTelegramMessage } from "@/lib/notifications/telegram";
import { getSubscribersByTrigger } from "@/lib/notifications/store";
import { yieldAlertMessage, portfolioSummaryMessage } from "@/lib/notifications/templates";
import { getMockPortfolio } from "@/lib/mock/portfolio";
import { getLiveBalances } from "@/lib/chain/balances";
import { buildSnapshot } from "@/lib/ai/metrics";
import type { Address } from "@/lib/types";

/** Threshold: APY must change by at least this many percentage points to trigger an alert. */
const APY_DELTA_THRESHOLD = 1.0;

/** Last-known APYs per pool id (in-memory, resets on restart). */
const lastKnownApy = new Map<string, number>();

/** Check for significant yield changes and notify subscribers. */
export async function checkYieldAlerts(): Promise<{
  alertsSent: number;
  poolsChecked: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let alertsSent = 0;

  // Fetch current pools.
  let pools;
  try {
    const result = await getOpportunities({ limit: 50, minTvl: 500_000 });
    pools = result.opportunities;
  } catch (err) {
    errors.push(`Failed to fetch opportunities: ${err instanceof Error ? err.message : "unknown"}`);
    return { alertsSent: 0, poolsChecked: 0, errors };
  }

  // Get subscribers who want yield alerts.
  const subscribers = getSubscribersByTrigger("yield");
  if (subscribers.length === 0) {
    return { alertsSent: 0, poolsChecked: pools.length, errors };
  }

  // Detect changes.
  const alerts: Array<{
    subscriber: (typeof subscribers)[0];
    pool: (typeof pools)[0];
    oldApy: number;
  }> = [];

  for (const pool of pools) {
    const prev = lastKnownApy.get(pool.id);
    if (prev !== undefined) {
      const delta = Math.abs(pool.apy - prev);
      if (delta >= APY_DELTA_THRESHOLD) {
        for (const sub of subscribers) {
          alerts.push({ subscriber: sub, pool, oldApy: prev });
        }
      }
    }
    lastKnownApy.set(pool.id, pool.apy);
  }

  // Send alerts.
  for (const alert of alerts) {
    try {
      const text = yieldAlertMessage({
        protocol: alert.pool.protocol,
        asset: alert.pool.asset,
        chain: alert.pool.chain,
        oldApy: alert.oldApy,
        newApy: alert.pool.apy,
        tvl: alert.pool.tvl,
      });
      await sendTelegramMessage({ chatId: alert.subscriber.chatId, text });
      alertsSent++;
    } catch (err) {
      errors.push(`Failed to send alert to ${alert.subscriber.chatId}: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  return { alertsSent, poolsChecked: pools.length, errors };
}

/** Send a portfolio summary to a specific chat. */
export async function sendPortfolioSummary(
  chatId: number,
  walletAddress: Address
): Promise<{ sent: boolean; error?: string }> {
  try {
    // Try to fetch live on-chain balances first
    let portfolio;
    try {
      portfolio = await getLiveBalances(walletAddress, 1); // Ethereum mainnet
    } catch (liveError) {
      // Fall back to mock portfolio if live read fails
      portfolio = getMockPortfolio(walletAddress);
    }
    const snapshot = buildSnapshot(portfolio);

    // Get best opportunity.
    let topOpportunity: { protocol: string; asset: string; apy: number } | undefined;
    try {
      const { opportunities } = await getOpportunities({ limit: 5, minTvl: 1_000_000 });
      if (opportunities.length > 0) {
        topOpportunity = {
          protocol: opportunities[0].protocol,
          asset: opportunities[0].asset,
          apy: opportunities[0].apy,
        };
      }
    } catch {
      // Best effort — don't fail the whole message.
    }

    const text = portfolioSummaryMessage({
      address: walletAddress,
      totalUsdValue: snapshot.totalUsdValue,
      idleCashUsd: snapshot.idleCashUsd,
      assetCount: snapshot.assetCount,
      topHoldings: snapshot.tokens.slice(0, 4).map((t) => ({
        symbol: t.symbol,
        usdValue: t.usdValue,
      })),
      topOpportunity,
    });

    await sendTelegramMessage({ chatId, text });
    return { sent: true };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : "unknown" };
  }
}
