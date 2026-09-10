/**
 * The tool-using financial agent.
 *
 * Flow (per the brief):
 *   1. Understand the portfolio (tools: getWalletPortfolio / calculatePortfolioMetrics)
 *   2. Inspect relevant assets            (tools: getDeFiOpportunities / getProtocolData)
 *   3. Compare opportunities              (tools: calculateExpectedYield / calculateRiskScore / simulateAllocation)
 *   4. Finalize a validated allocation    (tool: finalizeRecommendation — code-validated)
 *   5. Explain the recommendation          (second LLM call over the computed plan)
 *
 * The model never performs arithmetic and never writes figures into the plan:
 * every numeric in the result is produced by deterministic code. Percentages are
 * the only thing the model proposes, and they are normalized + validated.
 */
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

import { createFallbackRecommendation } from "@/lib/ai/fallback";
import {
  executeTool,
  TOOL_SCHEMAS,
  type FinalizedPlan,
} from "@/lib/ai/tools";
import type { Address, DeFiOpportunity, Recommendation } from "@/lib/types";

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const MAX_ROUNDS = 7;

const SYSTEM_PROMPT = `You are DeFiPilot, a financial analysis agent for DeFi. You analyze a wallet, discover DeFi opportunities, quantify risk, and produce an explainable allocation plan.

STRICT RULES
- You are a TOOL-USER, not a calculator. Every financial number must come from a tool. NEVER compute amounts, yields, total values or risk scores yourself — call the tools and quote their outputs.
- All data is ground truth from tools. NEVER invent APYs, prices, TVL, balances, protocols or transactions. Do not mention a protocol's yield unless you saw it in a tool result.
- If a tool returns available:false, state clearly in the summary and warnings that that data is unavailable — do not fill the gap with guesses.
- Work flow: (1) call getWalletPortfolio or calculatePortfolioMetrics for the wallet; (2) call getDeFiOpportunities to discover pools (limit 10-25) and getProtocolData for specific protocols you care about; (3) use calculateExpectedYield / calculateRiskScore / simulateAllocation to compare candidate strategies against the wallet's deployable capital; (4) in the final step call finalizeRecommendation with your proposed percentages (they only need to total roughly 100 — code normalizes them). You must call finalizeRecommendation exactly once to finish.
- Propose percentages of the deployable stablecoin capital shown by the tools. Deploy roughly 60%/30%/10% across 2 lower-risk pools and 1 higher-yield pool when the data supports it; prefer distinct protocols for diversification.
- Be concise and specific. There is no need to summarize numbers you have already seen in a tool result — finalizeRecommendation produces the definitive figures.
- The wallet contains simulated (demo) balances — say so.`;

function buildUserPrompt(address: Address): string {
  return `Analyze wallet ${address} and produce a personalized DeFi yield recommendation.
Use the tools to inspect the portfolio, discover opportunities, and then call finalizeRecommendation with your proposed allocation. Remember: reason over tool results; never do arithmetic or invent figures.`;
}

function safeParseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    // Try to recover a JSON object from a text-wrapped response.
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

interface ExplainResult {
  summary: string;
  reasoning: string[];
  warnings: string[];
  assumptions: string[];
}

const EXPLANATION_SYSTEM_PROMPT = `You are the explanation writer for DeFiPilot. You are given the wallet snapshot and the finalized, VOID-computed allocation plan (all amounts, APYs, yields and risk scores were computed by deterministic code from live data — never alter them).
Write a concise, honest explanation for a retail user. Rules:
- summary: 2-3 sentences stating what the plan does, roughly how much is deployed, expected annual yield and blended APY, and risk. Do not quote any number that is not in the data provided.
- reasoning: 2-4 short points explaining WHY this allocation was chosen (diversification, risk-to-yield trade-off, idle capital). Only reference numbers/APYs from the provided data.
- warnings: include anything the data flags (unavailable data, demo/simulated balances, yields can change, high risk). If the data says live yield data is unavailable, you MUST say so prominently.
- assumptions: list the assumptions baked into the plan (capital deployed = stablecoin idle cash, APY constant over a year, no fees/gas/slippage, snapshot at a point in time).
- Keep the tone professional and non-dramatic. Do not use markdown lists with "**" — plain sentences in arrays.`;

const EXPLANATION_SCHEMA: Record<string, unknown> = {
  type: "object",
  strict: true,
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    reasoning: {
      type: "array",
      items: { type: "string" },
    },
    warnings: {
      type: "array",
      items: { type: "string" },
    },
    assumptions: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["summary", "reasoning", "warnings", "assumptions"],
};

function getClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey, timeout: 60_000, maxRetries: 1 });
}

export async function runAnalysisAgent(address: Address): Promise<Recommendation> {
  const client = getClient();
  if (!client) {
    return createFallbackRecommendation(address);
  }

  try {
    const plan = await runToolLoop(client, address);
    const explanation = await writeExplanation(client, address, plan);
    return assembleRecommendation(plan, explanation);
  } catch {
    // Deterministic safety net so the demo never breaks.
    return createFallbackRecommendation(address);
  }
}

async function runToolLoop(
  client: OpenAI,
  address: Address
): Promise<FinalizedPlan> {
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildUserPrompt(address) },
  ];

  let finalPlan: FinalizedPlan | null = null;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages,
      tools: TOOL_SCHEMAS,
      tool_choice: "auto",
      temperature: 0.2,
    });

    const message = completion.choices[0]?.message;
    if (!message) throw new Error("Agent returned no message.");

    messages.push(message);

    const toolCalls = message.tool_calls ?? [];
    if (toolCalls.length === 0) {
      if (finalPlan) break;
      messages.push({
        role: "user",
        content:
          "You must finish by calling finalizeRecommendation once. Do not restate numbers from memory.",
      });
      continue;
    }

    for (const toolCall of toolCalls) {
      if (!("function" in toolCall)) continue;
      const name = toolCall.function.name;
      const args = safeParseJson<Record<string, unknown>>(
        toolCall.function.arguments
      );
      let output: string;
      try {
        const result = await executeTool(name, args ?? {}, { address });
        output = JSON.stringify(result);
        if (result !== null && typeof result === "object") {
          const asPlan = result as Partial<FinalizedPlan>;
          if (
            name === "finalizeRecommendation" &&
            typeof asPlan.available === "boolean" &&
            !asPlan.allocations
          ) {
            // {"valid":false,...} — no plan; keep looping.
          }
        }
        if (name === "finalizeRecommendation" && (result as FinalizedPlan).available) {
          finalPlan = result as FinalizedPlan;
        }
      } catch (err) {
        output = JSON.stringify({
          error: err instanceof Error ? err.message : "tool execution failed",
        });
      }
      messages.push({ role: "tool", tool_call_id: toolCall.id, content: output });
    }

    if (finalPlan) break;
  }

  if (!finalPlan || !finalPlan.available) {
    throw new Error("Agent did not produce a finalized plan within the round limit.");
  }
  return finalPlan;
}

async function writeExplanation(
  client: OpenAI,
  address: Address,
  plan: FinalizedPlan
): Promise<ExplainResult> {
  const payload = JSON.stringify(
    {
      wallet: address,
      portfolio: {
        totalUsdValue: plan.portfolio.totalUsdValue,
        idleCashUsd: plan.portfolio.idleCashUsd,
        tokenSymbols: plan.portfolio.tokens.map((t) => t.symbol),
        source: plan.portfolio.source,
      },
      plan: {
        capitalDeployedUsd: plan.capitalDeployedUsd,
        allocations: plan.allocations.map((a) => ({
          protocol: a.protocol,
          asset: a.asset,
          chain: a.chain,
          percentage: a.percentage,
          amountUsd: a.amountUsd,
          apy: a.apy,
          riskLevel: a.riskLevel,
          expectedYieldUsd: a.expectedYieldUsd,
        })),
        expectedYield: plan.expectedYield,
        risk: plan.risk,
      },
    },
    null,
    2
  );

  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: EXPLANATION_SYSTEM_PROMPT },
      { role: "user", content: payload },
    ],
    temperature: 0.3,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "explanation",
        strict: true,
        schema: EXPLANATION_SCHEMA,
      },
    },
  });

  const text = completion.choices[0]?.message?.content;
  if (!text) throw new Error("Explanation model returned no content.");

  const parsed = safeParseJson<ExplainResult>(text);
  if (!parsed || typeof parsed.summary !== "string") {
    throw new Error("Explanation model returned malformed JSON.");
  }

  return {
    summary: parsed.summary.trim(),
    reasoning: Array.isArray(parsed.reasoning) ? parsed.reasoning : [],
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
    assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions : [],
  };
}

function assembleRecommendation(
  plan: FinalizedPlan,
  explanation: ExplainResult
): Recommendation {
  const opportunities: DeFiOpportunity[] = plan.opportunities.map((o) => ({
    id: o.id,
    protocol: o.protocol,
    chain: o.chain,
    asset: o.asset,
    apy: o.apy,
    tvl: o.tvl,
    riskScore: o.riskScore,
    riskLevel: o.riskLevel,
  }));

  return {
    summary: explanation.summary,
    currentPortfolio: plan.portfolio,
    opportunities,
    recommendedAllocation: plan.allocations,
    expectedYield: {
      totalUsd: plan.expectedYield.totalUsd,
      blendedApy: plan.expectedYield.blendedApy,
      perItemUsd: plan.expectedYield.perItemUsd,
    },
    riskLevel: plan.risk.riskLevel,
    riskScore: plan.risk.riskScore,
    reasoning: explanation.reasoning,
    warnings: explanation.warnings,
    assumptions: explanation.assumptions,
    engine: "llm",
    dataProvidedAt: new Date().toISOString(),
  };
}