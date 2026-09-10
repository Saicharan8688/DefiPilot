/**
 * Telegram message templates using MarkdownV2 format.
 * All user-visible values are escaped for Telegram's MarkdownV2 parser;
 * template markup and unicode glyphs are emitted literally.
 */

function esc(text: string | number): string {
  return String(text).replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$&");
}

export function yieldAlertMessage(params: {
  protocol: string;
  asset: string;
  chain: string;
  oldApy: number;
  newApy: number;
  tvl: number;
}): string {
  const delta = ((params.newApy - params.oldApy) / Math.max(params.oldApy, 0.01)) * 100;
  const direction = params.newApy > params.oldApy ? "📈" : "📉";

  const apy = `${esc(params.oldApy.toFixed(2))}% → ${esc(params.newApy.toFixed(2))}% (${delta > 0 ? "+" : ""}${esc(delta.toFixed(1))}%)`;

  return [
    `${direction} *Yield Alert*`,
    ``,
    `*${esc(params.protocol)}* ${esc(params.asset)}`,
    `Chain: ${esc(params.chain)}`,
    ``,
    `APY: ${apy}`,
    `TVL: $${esc(formatCompact(params.tvl))}`,
    ``,
    `_Live data from DefiLlama — APYs can change quickly_`,
  ].join("\n");
}

export function portfolioSummaryMessage(params: {
  address: string;
  totalUsdValue: number;
  idleCashUsd: number;
  assetCount: number;
  topHoldings: Array<{ symbol: string; usdValue: number }>;
  topOpportunity?: { protocol: string; asset: string; apy: number };
}): string {
  const addr = shorten(params.address);
  const idlePct = params.totalUsdValue > 0
    ? ((params.idleCashUsd / params.totalUsdValue) * 100).toFixed(0)
    : "0";

  const lines = [
    `📊 *Portfolio Summary*`,
    ``,
    `\`${esc(addr)}\``,
    `Total: *$${esc(formatCompact(params.totalUsdValue))}*`,
    `Idle cash: $${esc(formatCompact(params.idleCashUsd))} (${esc(idlePct)}%)`,
    `Assets: ${esc(params.assetCount)}`,
  ];

  if (params.topHoldings.length > 0) {
    lines.push(``, `*Top holdings:*`);
    for (const t of params.topHoldings.slice(0, 4)) {
      lines.push(`  · ${esc(t.symbol)}: $${esc(formatCompact(t.usdValue))}`);
    }
  }

  if (params.topOpportunity) {
    lines.push(
      ``,
      `*Best opportunity:* ${esc(params.topOpportunity.protocol)} ${esc(params.topOpportunity.asset)} at ${esc(params.topOpportunity.apy.toFixed(2))}% APY`
    );
  }

  lines.push(``, `_Tap /portfolio for a full refresh_`);
  return lines.join("\n");
}

export function recommendationMessage(params: {
  summary: string;
  riskLevel: string;
  blendedApy: number;
  totalYieldUsd: number;
  allocations: Array<{ protocol: string; asset: string; percentage: number; apy: number }>;
}): string {
  const allocs = params.allocations
    .map(
      (a) =>
        `  ${esc(a.percentage.toFixed(0))}% → ${esc(a.protocol)} ${esc(a.asset)} (${esc(a.apy.toFixed(2))}% APY)`
    )
    .join("\n");

  return [
    `🤖 *DeFiPilot Recommendation*`,
    ``,
    `*${esc(params.riskLevel)} risk* · ≈${esc(params.blendedApy.toFixed(2))}% blended APY`,
    `Expected yield: *$${esc(formatCompact(params.totalYieldUsd))}*/year`,
    ``,
    `*Allocation plan:*`,
    allocs,
    ``,
    `_This is a simulation — nothing is executed or broadcast._`,
  ].join("\n");
}

export function registeredMessage(walletAddress: string): string {
  return [
    `✅ *Notifications enabled*`,
    ``,
    `Wallet: \`${esc(shorten(walletAddress))}\``,
    ``,
    `You'll receive:`,
    `  · Yield alerts when tracked pools change`,
    `  · Portfolio snapshots on demand`,
    `  · AI recommendations`,
    ``,
    `Commands:`,
    `  /portfolio — get a snapshot now`,
    `  /stop — disable notifications`,
    `  /status — check your settings`,
  ].join("\n");
}

export function stoppedMessage(): string {
  return `🔕 *Notifications disabled*\n\nYou won't receive any more alerts. Use /start to re-enable.`;
}

export function statusMessage(params: {
  walletAddress: string;
  triggers: string[];
}): string {
  return [
    `📋 *Notification Status*`,
    ``,
    `Wallet: \`${esc(shorten(params.walletAddress))}\``,
    `Active triggers: ${params.triggers.map(esc).join(", ") || "none"}`,
  ].join("\n");
}

export function helpMessage(): string {
  return [
    `🤖 *DeFiPilot Bot*`,
    ``,
    `I send you DeFi yield alerts, portfolio summaries, and AI recommendations directly in Telegram.`,
    ``,
    `*Commands:*`,
    `  /start <wallet_address> — link a wallet and enable notifications`,
    `  /stop — disable notifications`,
    `  /portfolio — get a portfolio snapshot now`,
    `  /status — check your notification settings`,
    `  /help — show this message`,
    ``,
    `_Powered by DeFiPilot — AI DeFi agent_`,
  ].join("\n");
}

function shorten(address: string): string {
  return address.length > 10
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : address;
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(0);
}