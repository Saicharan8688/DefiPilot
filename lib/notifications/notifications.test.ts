import { describe, it, expect } from "vitest";
import {
  yieldAlertMessage,
  portfolioSummaryMessage,
  recommendationMessage,
  registeredMessage,
  helpMessage,
  statusMessage,
  stoppedMessage,
} from "@/lib/notifications/templates";
import {
  registerSubscriber,
  getSubscriber,
  removeSubscriber,
  getSubscriberByWallet,
  getSubscribersByTrigger,
  getSubscriberCount,
} from "@/lib/notifications/store";
import { parseTelegramCommand } from "@/lib/notifications/commands";

const ADDRESS = "0xdcf1a13b2a5e2c4f9a8e7d1c3b5f9a7e1c3d5b2a";

describe("notification templates (MarkdownV2)", () => {
  it("yield alert escapes protocol text and includes delta", () => {
    const msg = yieldAlertMessage({
      protocol: "Maple Finance",
      asset: "USDC",
      chain: "Ethereum",
      oldApy: 4.5,
      newApy: 6.0,
      tvl: 45_000_000,
    });
    expect(msg).toContain("*Yield Alert*");
    expect(msg).toContain("*Maple Finance*");
    expect(msg).toContain("4\\.50%");
    expect(msg).toContain("6\\.00%");
    expect(msg).toContain("$45\\.0M");
  });

  it("portfolio summary includes total, idle cash, and top holdings", () => {
    const msg = portfolioSummaryMessage({
      address: ADDRESS,
      totalUsdValue: 10000,
      idleCashUsd: 4000,
      assetCount: 3,
      topHoldings: [
        { symbol: "USDC", usdValue: 4000 },
        { symbol: "ETH", usdValue: 5000 },
      ],
      topOpportunity: { protocol: "Aave", asset: "USDC", apy: 4.89 },
    });
    expect(msg).toContain("*Portfolio Summary*");
    expect(msg).toContain("*$10\\.0K*");
    expect(msg).toContain("Aave");
    expect(msg.length).toBeGreaterThan(50);
    // Wallet addresses used in `code` spans are escaped.
    expect(msg).not.toContain(ADDRESS);
  });

  it("recommendation message lists allocations with APYs", () => {
    const msg = recommendationMessage({
      summary: "Deploy $4,374 across 3 pools",
      riskLevel: "Medium",
      blendedApy: 17.69,
      totalYieldUsd: 773.8,
      allocations: [
        { protocol: "Maple", asset: "USDC", percentage: 60, apy: 4.96 },
        { protocol: "Fluid", asset: "DAI", percentage: 30, apy: 3.45 },
        { protocol: "Harvest", asset: "BTC", percentage: 10, apy: 13.2 },
      ],
    });
    expect(msg).toContain("*DeFiPilot Recommendation*");
    expect(msg).toContain("60%");
    expect(msg).toContain("$774");
    expect(msg).toContain("nothing is executed");
  });

  it("registered message includes commands", () => {
    const msg = registeredMessage(ADDRESS);
    expect(msg).toContain("*Notifications enabled*");
    expect(msg).toContain("/portfolio");
    expect(msg).toContain("/stop");
  });

  it("status/help/stop render", () => {
    expect(statusMessage({ walletAddress: ADDRESS, triggers: ["yield", "portfolio"] })).toContain("yield, portfolio");
    expect(helpMessage()).toContain("/start");
    expect(stoppedMessage()).toContain("Notifications disabled");
  });
});

describe("telegram command parser", () => {
  it("parses /start with a wallet arg", () => {
    const { cmd, args } = parseTelegramCommand(`/start ${ADDRESS}`);
    expect(cmd).toBe("start");
    expect(args).toEqual([ADDRESS]);
  });

  it("is case-insensitive and strips @botName suffix", () => {
    expect(parseTelegramCommand("/Stop@MyBot").cmd).toBe("stop");
    expect(parseTelegramCommand("/PORTFOLIO").cmd).toBe("portfolio");
  });

  it("handles bare text (no command) and leading/trailing whitespace", () => {
    const bare = parseTelegramCommand("  hello world  ");
    expect(bare.cmd).toBe("");
    expect(bare.args).toEqual(["hello", "world"]);
    expect(parseTelegramCommand("/help").args).toEqual([]);
  });

  it("does not treat /start as empty (regression)", () => {
    expect(parseTelegramCommand("/start").cmd).toBe("start");
  });
});

describe("notification subscriber store", () => {
  it("registers, finds, and removes subscribers", () => {
    expect(getSubscriberCount()).toBe(0);
    registerSubscriber(12345, ADDRESS);
    expect(getSubscriberCount()).toBe(1);

    const sub = getSubscriber(12345);
    expect(sub).toBeDefined();
    expect(sub!.walletAddress).toBe(ADDRESS.toLowerCase());
    expect(sub!.triggers).toEqual(["yield", "portfolio", "recommendation"]);

    expect(getSubscriberByWallet(ADDRESS)?.chatId).toBe(12345);
    expect(getSubscribersByTrigger("yield").length).toBe(1);
    expect(getSubscribersByTrigger("portfolio").length).toBe(1);

    expect(removeSubscriber(12345)).toBe(true);
    expect(getSubscriberCount()).toBe(0);
    expect(removeSubscriber(12345)).toBe(false);
  });

  it("overrides an existing subscriber for the same chat", () => {
    registerSubscriber(999, ADDRESS, ["yield"]);
    registerSubscriber(999, "0x1111111111111111111111111111111111111111", ["portfolio"]);
    expect(getSubscriberCount()).toBe(1);
    expect(getSubscriber(999)!.walletAddress).toBe("0x1111111111111111111111111111111111111111");
    expect(getSubscribersByTrigger("yield").length).toBe(0);
    expect(getSubscribersByTrigger("portfolio").length).toBe(1);
  });
});