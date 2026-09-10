/**
 * Deterministic, transparent risk scoring for a DefiLlama pool.
 *
 * The score is a weighted sum of objective inputs — no LLM, no guessing:
 *   - APY magnitude       (higher advertised APY ⇒ higher risk)     up to 35
 *   - Reward share        (rewards ‑ not base ‑ are less durable)   up to 20
 *   - APY volatility      (recent daily swings)                     up to 10
 *   - Liquidity / TVL     (less capital locked ⇒ harder to exit)    up to 25
 *   - Impermanent loss    (multi‑asset exposure)                    up to 10
 *
 * Final score is clamped to 1..99.
 */
import type { DefiLlamaPool } from "@/lib/defi/defillama-types";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function computeRiskScore(pool: DefiLlamaPool): number {
  const apy = pool.apy ?? 0;

  // 4% APY → 0, 29% APY → full weight.
  const apyMagnitude = clamp((apy - 4) / 25, 0, 1) * 35;

  // Reward-heavy yields are less durable than base yields.
  const rewardShare =
    pool.apyReward && pool.apy ? clamp(pool.apyReward / pool.apy, 0, 1) * 20 : 0;

  // Recent changes in the advertised yield.
  const changes = [pool.apyPct1D, pool.apyPct7D, pool.apyPct30D].filter(
    (n): n is number => n !== null && n !== undefined && Number.isFinite(n)
  );
  const maxChange = changes.length ? Math.max(...changes.map(Math.abs)) : 0;
  const volatility = clamp(maxChange / 15, 0, 1) * 10;

  // Log-scale: 100M+ TVL is liquid; small pools are riskier.
  const tvl = Math.max(pool.tvlUsd, 0);
  const liquidity = clamp(1 - Math.log10(tvl + 1) / 8, 0, 1) * 25;

  const impermanentLoss =
    pool.ilRisk === "yes" || pool.exposure === "multi" ? 10 : 0;

  const score =
    apyMagnitude + rewardShare + volatility + liquidity + impermanentLoss;

  return Math.round(clamp(score, 1, 99));
}

export function riskLevelFor(score: number): "Low" | "Medium" | "High" {
  if (score < 30) return "Low";
  if (score <= 60) return "Medium";
  return "High";
}