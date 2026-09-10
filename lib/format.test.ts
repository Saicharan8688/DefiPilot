import { describe, it, expect } from "vitest";
import {
  formatUsd,
  formatCompactUsd,
  formatApy,
  formatPct,
  formatNumber,
  shortenAddress,
  formatRelativeTime,
} from "@/lib/format";

describe("format utils", () => {
  it("formats USD with 2 decimals by default", () => {
    expect(formatUsd(1234.5)).toBe("$1,234.50");
    expect(formatUsd(0)).toBe("$0.00");
  });

  it("formats compact USD (K/M/B)", () => {
    expect(formatCompactUsd(1500)).toBe("$1.5K");
    expect(formatCompactUsd(2_400_000)).toBe("$2.40M");
    expect(formatCompactUsd(3_200_000_000)).toBe("$3.20B");
    expect(formatCompactUsd(999)).toBe("$999");
  });

  it("formats APY and percentages", () => {
    expect(formatApy(17.689)).toBe("17.69% APY");
    expect(formatPct(12.345, 2)).toBe("12.35%");
  });

  it("formats numbers with limited digits", () => {
    expect(formatNumber(1234.56789, 2)).toBe("1,234.57");
  });

  it("shortens addresses preserving the checksum prefix edge", () => {
    const addr = "0xdcf1a13b2a5e2c4f9a8e7d1c3b5f9a7e1c3d5b2a";
    expect(shortenAddress(addr)).toBe("0xdcf1…5b2a");
    expect(shortenAddress("")).toBe("");
    expect(shortenAddress("0x1234", 2)).toBe("0x1234");
  });

  it("formats relative times", () => {
    const now = Date.now();
    expect(formatRelativeTime(new Date(now - 30_000).toISOString())).toBe("30s ago");
    expect(formatRelativeTime(new Date(now - 5 * 60_000).toISOString())).toBe("5m ago");
    expect(formatRelativeTime(new Date(now - 2 * 3600_000).toISOString())).toBe("2h ago");
  });
});