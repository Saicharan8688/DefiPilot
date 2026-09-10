/**
 * Deterministic "agent assistant": answers questions about the analysis using
 * code over ground truth — never from a model's imagination. Every figure is
 * computed from the same portfolio snapshot, live opportunities and simulation
 * math that produced the recommendation.
 *
 * Designed to be fast (the underlying reads are TTL-cached) and reliable:
 * when data is missing, the agent says so instead of inventing numbers.
 */
import { createFallbackRecommendation } from "@/lib/ai/fallback";
import { buildSimulation } from "@/lib/ai/simulation";
import {
  getOpportunitiesByAssets,
  getProtocolOpportunities,
} from "@/lib/defi/defillama";
import { formatUsd, shortenAddress } from "@/lib/format";
import type {
  Address,
  AgentAnswer,
  AgentAnswerSection,
  AgentIntent,
  DeFiOpportunity,
  Recommendation,
  RecommendedAllocationItem,
  SimulationResult,
} from "@/lib/types";

const STABLE_LIKE = ["USDC", "USDT", "DAI", "FRAX", "USDE", "PYUSD", "TUSD", "LUSD", "GUSD"];
const KNOWN_PROTOCOLS = [
  "aave",
  "compound",
  "fluid",
  "maple",
  "curve",
  "sparklend",
  "spark",
  "sky",
  "morpho",
  "euler",
  "ajna",
  "pendle",
  "dolomite",
  "stable",
  "atos",
  "defira",
  "velodrome",
];

const SECTION_ORDER: Array<AgentAnswerSection["key"]> = [
  "portfolioInsight",
  "opportunitiesFound",
  "riskAnalysis",
  "recommendedAction",
  "whyRecommendation",
  "expectedOutcome",
  "risksWarnings",
];

const SECTION_META: Record<AgentAnswerSection["key"], { heading: string }> = {
  portfolioInsight: { heading: "Portfolio insight" },
  opportunitiesFound: { heading: "Opportunities found" },
  riskAnalysis: { heading: "Risk analysis" },
  recommendedAction: { heading: "Recommended action" },
  whyRecommendation: { heading: "Why this recommendation" },
  expectedOutcome: { heading: "Expected outcome" },
  risksWarnings: { heading: "Risks / warnings" },
};

function S(
  key: AgentAnswerSection["key"],
  text: string,
  bullets?: AgentAnswerSection["bullets"],
  tone: AgentAnswerSection["tone"] = "default"
): AgentAnswerSection {
  return { key, heading: SECTION_META[key].heading, text, bullets, tone };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function pct(n: number): string {
  return `${round2(n)}%`;
}

/* ------------------------------------------------------------------ */
/* Intent classification                                               */
/* ------------------------------------------------------------------ */

interface QuestionContext {
  asset?: string;
  protocol?: string;
  pct?: number;
}

function findToken(question: string, rec: Recommendation): string | undefined {
  const q = question.toUpperCase();
  const walletSymbols = rec.currentPortfolio.tokens.map((t) => t.symbol.toUpperCase());
  const candidates = [...STABLE_LIKE, "ETH", "WETH", ...walletSymbols].sort(
    (a, b) => b.length - a.length
  );
  return candidates.find((sym) => {
    const token = rec.currentPortfolio.tokens.find((t) => t.symbol.toUpperCase() === sym);
    return q.includes(sym) && (token ? token.usdValue > 0 : true);
  });
}

function findProtocol(question: string, rec: Recommendation): string | undefined {
  const q = question.toLowerCase();
  const inScope = [
    ...new Set(rec.opportunities.map((o) => o.protocol.toLowerCase())),
  ].sort((a, b) => b.length - a.length);
  return [...inScope, ...KNOWN_PROTOCOLS]
    .sort((a, b) => b.length - a.length)
    .find((p) => new RegExp(`\\b${p}\\b`).test(q));
}

function classifyIntent(question: string): AgentIntent {
  const q = question.toLowerCase();
  const hasNumber = /\d+(\.\d+)?\s*%?/.test(q);

  if (hasNumber && /\b(allocate|allocation|instead|what happens if|if i put|switch)\b/.test(q)) {
    return "ALTERNATIVE_ALLOCATION";
  }
  if (/\bidle\b|\bwhere should i (put|deploy|park)\b|\bput my\b|\bdeploy my\b/.test(q)) {
    return "IDLE_CAPITAL";
  }
  if (/\bwhy\b/.test(q) && /(recommend|choose|pick|suggest|prefer|instead)|aave|compound|maple|curve|fluid|spark/.test(q)) {
    return "WHY_PROTOCOL";
  }
  if (/riskiest|most risky|highest risk|riskiest option|what.{0,15}\brisk\b/.test(q)) {
    return "RISKIEST_OPTION";
  }
  if (/(yield|interest|earn|profit|return|apy)/.test(q) && /(how much|could i|can i|would|potential|expected|potentially)/.test(q)) {
    return "EXPECTED_YIELD";
  }
  if (/concentrat|diversif|spread my|all in one|eggs/.test(q)) {
    return "CONCENTRATION";
  }
  return "GENERAL";
}

function extractContext(question: string, rec: Recommendation): QuestionContext {
  const ctx: QuestionContext = {};
  const asset = findToken(question, rec);
  if (asset) ctx.asset = asset;
  const protocol = findProtocol(question, rec);
  if (protocol) ctx.protocol = protocol;
  const num = question.match(/(\d{1,3}(?:\.\d+)?)\s*%/);
  if (num) ctx.pct = Math.max(1, Math.min(100, Number(num[1])));
  return ctx;
}

/* ------------------------------------------------------------------ */
/* Section builders                                                    */
/* ------------------------------------------------------------------ */

function portfolioSection(rec: Recommendation): AgentAnswerSection {
  const p = rec.currentPortfolio;
  const top = p.tokens[0];
  return S(
    "portfolioInsight",
    `Wallet ${shortenAddress(p.address)} holds ${formatUsd(p.totalUsdValue)} across ${
      p.assetCount
    } assets (${p.source === "demo" ? "simulated demo balances" : "on-chain balances"}). ${
      p.idleCashUsd > 0
        ? `${formatUsd(p.idleCashUsd)} is sitting idle in stablecoins — deployable capital.`
        : "There is no idle stablecoin capital to deploy."
    }`,
    [
      { label: "Total value", value: formatUsd(p.totalUsdValue) },
      { label: "Idle stablecoin capital", value: formatUsd(p.idleCashUsd) },
      top
        ? { label: "Largest holding", value: `${top.symbol} · ${pct(top.percentage)} · ${formatUsd(top.usdValue)}` }
        : { label: "Largest holding", value: "None" },
      { label: "Concentration", value: pct(p.concentration * 100) },
    ]
  );
}

function opportunitiesSection(rec: Recommendation): AgentAnswerSection {
  const list = rec.opportunities;
  if (list.length === 0) {
    return S(
      "opportunitiesFound",
      "No live pools could be scored for this wallet (data may be unavailable right now).",
      [],
      "warning"
    );
  }
  const top = [...list].sort((a, b) => b.apy - a.apy).slice(0, 3);
  return S(
    "opportunitiesFound",
    `I scored ${list.length} opportunities from live DefiLlama data against your wallet's assets, weighing yield vs liquidity and risk.`,
    top.map((o) => ({
      label: `${o.protocol} · ${o.asset}`,
      value: `${pct(o.apy)} APY · ${formatUsd(o.tvl, 0)} TVL · risk ${o.riskLevel}`,
    }))
  );
}

function riskSection(rec: Recommendation): AgentAnswerSection {
  const worst = [...rec.opportunities].sort((a, b) => b.riskScore - a.riskScore)[0];
  return S(
    "riskAnalysis",
    `The recommended plan has weighted risk ${rec.riskLevel} (score ${rec.riskScore}/99), computed from APY magnitude, reward share, volatility, liquidity and impermanent-loss exposure.`,
    [
      { label: "Plan risk", value: `${rec.riskLevel} · ${rec.riskScore}/99` },
      worst
        ? { label: "Riskiest pool scored", value: `${worst.protocol} ${worst.asset} · ${worst.riskScore}/99` }
        : { label: "Riskiest pool scored", value: "None" },
    ],
    rec.riskLevel === "High" ? "danger" : rec.riskLevel === "Medium" ? "warning" : "success"
  );
}

function actionSection(
  rec: Recommendation,
  alt?: { name: string; allocations: RecommendedAllocationItem[] }
): AgentAnswerSection {
  const allocations = rec.recommendedAllocation;
  if (allocations.length === 0) {
    return S(
      "recommendedAction",
      "No capital allocation could be constructed (no eligible opportunities or live data unavailable). Keeping capital as-is is the safest option right now.",
      [],
      "warning"
    );
  }
  const source = alt ?? { name: "", allocations };
  const title = alt
    ? `If you allocate ${alt.name}, the plan becomes:`
    : "Deploy idle stablecoin capital across diversified pools:";
  return S(
    "recommendedAction",
    title,
    source.allocations.map((a) => ({
      label: `${a.protocol} ${a.asset}`,
      value: `${pct(a.percentage)} · ${formatUsd(a.amountUsd)} · ${pct(a.apy)} APY · risk ${a.riskLevel}`,
    })),
    "success"
  );
}

function whySection(rec: Recommendation): AgentAnswerSection {
  const reasons = rec.reasoning.length > 0 ? rec.reasoning : ["No allocation could be reasoned about — see warnings."];
  return S(
    "whyRecommendation",
    "The plan maximizes expected yield per unit of risk using only code-computed figures.",
    reasons.map((r, i) => ({ label: `Reason ${i + 1}`, value: r }))
  );
}

function outcomeSection(
  rec: Recommendation,
  simulation?: SimulationResult | { totalUsd: number; blendedApy: number; perItemUsd?: number[] }
): AgentAnswerSection {
  const base = rec.expectedYield;
  let total = base.totalUsd;
  let blended = base.blendedApy;
  let perItem: number[] | undefined;
  if (simulation) {
    if ("totalUsd" in simulation) {
      total = simulation.totalUsd;
      blended = simulation.blendedApy;
      perItem = simulation.perItemUsd;
    } else {
      total = simulation.totalExpectedYieldUsd;
      blended = simulation.blendedApy;
    }
  }
  const items = rec.recommendedAllocation.map((a, i) => ({
    ...a,
    yieldUsd: perItem?.[i] ?? a.expectedYieldUsd,
  }));
  return S(
    "expectedOutcome",
    "Assuming current live APYs hold for a year (no fees, gas or slippage modeled), this is the expected outcome:",
    [
      { label: "Expected annual yield", value: `≈ ${formatUsd(total)}/yr (${pct(blended)} blended)` },
      { label: "≈ Monthly (APY ÷ 12)", value: `≈ ${formatUsd(total / 12)}` },
      ...items.map((a) => ({
        label: `${a.protocol} ${a.asset}`,
        value: `≈ ${formatUsd(a.yieldUsd)}/yr at ${pct(a.apy)}`,
      })),
    ].slice(0, 6),
    "success"
  );
}

function warningsSection(rec: Recommendation): AgentAnswerSection {
  const warnings = rec.warnings.length > 0 ? rec.warnings : ["No warnings recorded."];
  return S(
    "risksWarnings",
    "These are the honest caveats of the recommendation:",
    warnings.map((w) => ({ label: "Warning", value: w })),
    "warning"
  );
}

const FALLBACK_FOLLOW_UPS = [
  "Where should I put my idle USDC?",
  "Why are you recommending Aave?",
  "What happens if I allocate 50% instead?",
  "What is the riskiest option?",
  "How much yield could I potentially earn?",
  "What happens to my portfolio concentration?",
];

/* ------------------------------------------------------------------ */
/* Intent-specific answer builders                                     */
/* ------------------------------------------------------------------ */

function baseSections(rec: Recommendation): AgentAnswerSection[] {
  return [
    portfolioSection(rec),
    opportunitiesSection(rec),
    riskSection(rec),
    actionSection(rec),
    whySection(rec),
    outcomeSection(rec),
    warningsSection(rec),
  ];
}

async function answerIdle(rec: Recommendation, asset: string | undefined): Promise<AgentAnswerSection[]> {
  const p = rec.currentPortfolio;
  const token = asset ? p.tokens.find((t) => t.symbol.toUpperCase() === asset.toUpperCase()) : undefined;

  if (!token || token.usdValue <= 0) {
    return [
      portfolioSection(rec),
      S(
        "recommendedAction",
        asset
          ? `This wallet has no ${asset.toUpperCase()} balance, so there is nothing to deploy in that asset.`
          : "Specify the asset you mean (e.g. any of the stablecoins above); I can only reason about what I can verify.",
        [],
        "warning"
      ),
      whySection(rec),
      warningsSection(rec),
    ];
  }

  const symbol = token.symbol.toUpperCase();
  let pools: DeFiOpportunity[] = [];
  try {
    pools = await getOpportunitiesByAssets([symbol], { minTvl: 500_000, limit: 20 });
  } catch {
    pools = rec.opportunities.filter((o) => o.asset.toUpperCase().includes(symbol));
  }
  const safe = [...pools].sort((a, b) => a.riskScore - b.riskScore || b.apy - a.apy);
  const gain = [...pools].sort((a, b) => b.apy - a.apy);
  const best = safe[0];
  const bestYield = gain[0];

  const sections = baseSections(rec);
  const opportunity = S(
    "opportunitiesFound",
    best && bestYield
      ? `For ${symbol} I found ${pools.length} live pools (${bestYield.protocol} reaches ${pct(bestYield.apy)} APY).`
      : `No ${symbol} pools could be matched from live data — say so rather than invent one.`,
    [
      best
        ? { label: `Best risk-adjusted (${best.protocol})`, value: `${pct(best.apy)} APY · ${formatUsd(best.tvl, 0)} TVL · risk ${best.riskLevel}` }
        : { label: "Best risk-adjusted", value: "Unavailable" },
      bestYield && safe[0]?.id !== bestYield.id
        ? { label: `Highest yield (${bestYield.protocol})`, value: `${pct(bestYield.apy)} APY · risk ${bestYield.riskLevel}` }
        : { label: "Highest yield", value: best ? pct(best.apy) : "Unavailable" },
    ]
  );

  const where = best
    ? S(
        "recommendedAction",
        `With ${formatUsd(token.usdValue)} of ${symbol} idle, a conservative choice is ${best.protocol} ${best.asset}:`,
        [
          { label: "Deploy", value: formatUsd(token.usdValue) },
          { label: "Expected /yr", value: `≈ ${formatUsd(token.usdValue * (best.apy / 100))}` },
          { label: "Risk", value: `${best.riskLevel} · ${best.riskScore}/99` },
        ],
        "success"
      )
    : S("recommendedAction", "No deployable pool for this asset right now — I won't guess.", [], "danger");

  sections[1] = opportunity;
  sections[3] = where;
  return sections;
}

async function answerWhyProtocol(rec: Recommendation, protocol: string | undefined): Promise<AgentAnswerSection[]> {
  const sections = baseSections(rec);
  if (!protocol) {
    sections[4] = S(
      "whyRecommendation",
      "You asked about a protocol I don't recognize. These are the ones I did reason over:",
      rec.opportunities.map((o) => ({ label: `${o.protocol}`, value: `${pct(o.apy)} APY` })),
      "warning"
    );
    return sections;
  }
  const norm = protocol.toLowerCase();
  const inShortlist = rec.opportunities.some((o) => o.protocol.toLowerCase() === norm);
  const allocated = rec.recommendedAllocation.find((a) => a.protocol.toLowerCase() === norm);
  const pools = rec.opportunities.filter((o) => o.protocol.toLowerCase() === norm);

  if (allocated) {
    sections[4] = S(
      "whyRecommendation",
      `${allocated.protocol} was chosen because it was the best risk-adjusted match for your ${
        rec.currentPortfolio.idleCashUsd > 0 ? "idle stablecoin capital" : "assets"
      }.`,
      [
        { label: "Allocation", value: `${pct(allocated.percentage)} · ${formatUsd(allocated.amountUsd)}` },
        { label: "APY", value: pct(allocated.apy) },
        { label: "Risk", value: `${allocated.riskLevel} · ${allocated.riskScore}/99` },
        { label: "Expected /yr", value: `≈ ${formatUsd(allocated.expectedYieldUsd)}` },
      ],
      "success"
    );
    return sections;
  }

  let extra: DeFiOpportunity[] = [];
  if (inShortlist) {
    extra = pools;
  } else {
    try {
      extra = await getProtocolOpportunities(protocol);
    } catch {
      extra = [];
    }
  }

  if (extra.length > 0) {
    const top = [...extra].sort((a, b) => b.apy - a.apy)[0];
    sections[4] = S(
      "whyRecommendation",
      `${protocol} appears in the live data, but it was not part of this wallet's recommendation${
        inShortlist ? " (it was scored but fell outside the top risk-adjusted matches)" : ""
      }. Its best pool came in at ${pct(top.apy)} APY (risk ${top.riskLevel}).`,
      [
        { label: "Best pool", value: `${top.protocol} ${top.asset} · ${pct(top.apy)} APY · ${formatUsd(top.tvl, 0)} TVL` },
        { label: "Reason excluded", value: "Risk-adjusted scoring for your assets favored other protocols." },
      ],
      "warning"
    );
  } else {
    sections[4] = S(
      "whyRecommendation",
      `I could not verify any ${protocol} pools in the current live data for this wallet, so I can't comment on why it was or wasn't chosen. The honest answer: I don't have reliable data on it right now.`,
      [],
      "danger"
    );
  }
  return sections;
}

function answerAlternative(rec: Recommendation, pctValue: number | undefined): AgentAnswerSection[] {
  const sections = baseSections(rec);
  const allocations = rec.recommendedAllocation;
  if (allocations.length === 0) {
    sections[3] = S(
      "recommendedAction",
      "There is no current allocation to modify — no capital plan exists. Ask me about where yields are first.",
      [],
      "warning"
    );
    return sections;
  }
  const target = Math.max(1, Math.min(100, pctValue ?? allocations[0].percentage));
  const lead = allocations[0];
  const others = allocations.slice(1);
  const restPct = 100 - target;
  const othersSum = others.reduce((s, a) => s + a.percentage, 0) || 1;
  const idle = rec.currentPortfolio.idleCashUsd;
  const oppById = new Map(rec.opportunities.map((o) => [o.id, o]));

  const altAllocations: RecommendedAllocationItem[] = [
    {
      ...lead,
      percentage: target,
      amountUsd: round2(idle * (target / 100)),
      expectedYieldUsd: round2((idle * (target / 100)) * (lead.apy / 100)),
    },
    ...others.map((a) => {
      const p = round2((a.percentage / othersSum) * restPct);
      const amountUsd = round2(idle * (p / 100));
      return { ...a, percentage: p, amountUsd, expectedYieldUsd: round2(amountUsd * (a.apy / 100)) };
    }),
  ];

  const sim = buildSimulation(
    altAllocations.map((a) => ({
      opportunity: oppById.get(a.opportunityId) ?? ({
        id: a.opportunityId,
        protocol: a.protocol,
        chain: a.chain,
        asset: a.asset,
        apy: a.apy,
        tvl: 0,
        riskScore: a.riskScore,
        riskLevel: a.riskLevel,
      } as DeFiOpportunity),
      amountUsd: a.amountUsd,
    }))
  );

  sections[3] = actionSection(rec, { name: pct(target) + " to " + lead.protocol, allocations: altAllocations });
  sections[5] = outcomeSection(rec, sim);
  sections[2] = S(
    "riskAnalysis",
    `Risk moves too: with ${pct(target)} in ${lead.protocol}, allocation-level concentration rises to ${pct(target)}.`,
    [
      { label: "Current risk", value: `${rec.riskLevel} · ${rec.riskScore}/99` },
      { label: "Alternative risk", value: `${sim.riskLevel} · ${sim.riskScore}/99` },
    ],
    sim.riskLevel === "High" ? "danger" : sim.riskLevel === "Medium" ? "warning" : "success"
  );
  return sections;
}

function answerRiskiest(rec: Recommendation): AgentAnswerSection[] {
  const sections = baseSections(rec);
  const ranked = [...rec.opportunities].sort((a, b) => b.riskScore - a.riskScore).slice(0, 3);
  const inPlan = [...rec.recommendedAllocation].sort((a, b) => b.riskScore - a.riskScore)[0];
  sections[2] = S(
    "riskAnalysis",
    ranked.length > 0
      ? `The riskiest pools among those I scored are:`
      : "No pools were scored, so I can't rank risk.",
    ranked.map((o) => ({
      label: `${o.protocol} ${o.asset}`,
      value: `risk ${o.riskLevel} · ${o.riskScore}/99 · ${pct(o.apy)} APY`,
    })),
    ranked[0] && ranked[0].riskLevel === "High" ? "danger" : "warning"
  );
  if (inPlan) {
    sections[3] = S(
      "recommendedAction",
      `Within the actual recommendation, the highest-risk position is ${inPlan.protocol} ${inPlan.asset} at ${pct(inPlan.percentage)} of capital.`,
      [
        { label: "Allocation", value: `${pct(inPlan.percentage)} · ${formatUsd(inPlan.amountUsd)}` },
        { label: "Risk", value: `${inPlan.riskLevel} · ${inPlan.riskScore}/99` },
      ],
      inPlan.riskLevel === "High" ? "danger" : "warning"
    );
  }
  return sections;
}

function answerYield(rec: Recommendation): AgentAnswerSection[] {
  const sections = baseSections(rec);
  const y = rec.expectedYield;
  sections[5] = S(
    "expectedOutcome",
    `Using today's live APYs, deploying the recommended allocation would earn:`,
    [
      { label: "Annual (approx)", value: `≈ ${formatUsd(y.totalUsd)}/yr` },
      { label: "Monthly (APY ÷ 12)", value: `≈ ${formatUsd(y.totalUsd / 12)}` },
      { label: "Blended APY", value: pct(y.blendedApy) },
      { label: "Capital deployed", value: formatUsd(
          rec.recommendedAllocation.reduce((s, a) => s + a.amountUsd, 0)
        ) },
    ],
    "success"
  );
  return sections;
}

function answerConcentration(rec: Recommendation): AgentAnswerSection[] {
  const sections = baseSections(rec);
  const p = rec.currentPortfolio;
  const top = p.tokens[0];
  const largestAlloc = [...rec.recommendedAllocation].sort((a, b) => b.percentage - a.percentage)[0];
  sections[1] = S(
    "opportunitiesFound",
    `Your portfolio is ${pct(p.concentration * 100)} in ${top ? top.symbol : "one asset"} across ${p.assetCount} holdings${
      largestAlloc ? `; the recommended plan splits deployable capital across ${rec.recommendedAllocation.length} pools with the largest slice at ${pct(largestAlloc.percentage)}.` : "."
    }`,
    [
      { label: "Portfolio concentration", value: `${pct(p.concentration * 100)} (${top ? top.symbol : "top asset"})` },
      { label: "Distinct holdings", value: String(p.assetCount) },
      largestAlloc
        ? { label: "Largest allocation slice", value: `${largestAlloc.protocol} · ${pct(largestAlloc.percentage)}` }
        : { label: "Largest allocation slice", value: "None" },
    ]
  );
  return sections;
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

export async function askAgent(address: Address, question: string): Promise<AgentAnswer> {
  const rec = await createFallbackRecommendation(address);
  const intent = classifyIntent(question);
  const ctx = extractContext(question, rec);

  let sections: AgentAnswerSection[];
  switch (intent) {
    case "IDLE_CAPITAL":
      sections = await answerIdle(rec, ctx.asset);
      break;
    case "WHY_PROTOCOL":
      sections = await answerWhyProtocol(rec, ctx.protocol);
      break;
    case "ALTERNATIVE_ALLOCATION":
      sections = answerAlternative(rec, ctx.pct);
      break;
    case "RISKIEST_OPTION":
      sections = answerRiskiest(rec);
      break;
    case "EXPECTED_YIELD":
      sections = answerYield(rec);
      break;
    case "CONCENTRATION":
      sections = answerConcentration(rec);
      break;
    default:
      sections = baseSections(rec);
  }

  const ordered = SECTION_ORDER.map((key) => sections.find((s) => s.key === key)).filter(
    (s): s is AgentAnswerSection => Boolean(s)
  );
  const focusedKeys = new Set(["IDLE_CAPITAL", "WHY_PROTOCOL", "ALTERNATIVE_ALLOCATION", "RISKIEST_OPTION"] as AgentIntent[]);
  if (focusedKeys.has(intent) && ordered.length >= 4) {
    // Keep canonical order but surface the focused section first when relevant.
    const focus = ["opportunitiesFound", "recommendedAction", "whyRecommendation", "riskAnalysis"][
      ["IDLE_CAPITAL", "WHY_PROTOCOL", "ALTERNATIVE_ALLOCATION", "RISKIEST_OPTION"].indexOf(intent)
    ] as AgentAnswerSection["key"];
    const idx = ordered.findIndex((s) => s.key === focus);
    if (idx > 0) {
      const [moved] = ordered.splice(idx, 1);
      ordered.unshift(moved);
    }
  }

  const dataProvidedAt = new Date().toISOString();
  return {
    intent,
    question,
    source: "deterministic",
    dataProvidedAt,
    sections: ordered,
    followUps: FALLBACK_FOLLOW_UPS,
    note: `Deterministic math engine · figures computed from live data at ${new Date(dataProvidedAt).toLocaleTimeString()} · nothing is executed or signed.`,
  };
}