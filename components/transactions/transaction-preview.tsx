"use client";

import { useState } from "react";
import type {
  Address,
  ApiResponse,
  RecommendedAllocationItem,
  SimulatedReceipt,
  TransactionPreview,
} from "@/lib/types";
import { formatUsd } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const RISK_TONE: Record<string, "success" | "warning" | "danger"> = {
  Low: "success",
  Medium: "warning",
  High: "danger",
};

/**
 * Transaction PREPARATION — deliberately sandbox-only. The AI proposes, but
 * the user stays in control: nothing is ever signed or broadcast here.
 */
export function TransactionPreviewCard({
  allocations,
  walletAddress,
  chainId,
}: {
  allocations: RecommendedAllocationItem[];
  walletAddress: Address;
  chainId: number;
}) {
  const [preview, setPreview] = useState<TransactionPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [simulated, setSimulated] = useState(false);
  const [consented, setConsented] = useState(false);
  const [receipt, setReceipt] = useState<SimulatedReceipt | null>(null);

  async function prepare() {
    setLoading(true);
    setError(null);
    setReceipt(null);
    try {
      const res = await fetch("/api/transactions/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: walletAddress,
          chainId,
          allocations: allocations.map((a) => ({
            opportunityId: a.opportunityId,
            amountUsd: a.amountUsd,
          })),
        }),
      });
      const json = (await res.json()) as ApiResponse<TransactionPreview>;
      if (!res.ok || !json.success) {
        throw new Error(json.success ? "Preview failed" : json.error.message);
      }
      setPreview(json.data);
      setSimulated(false);
      setConsented(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function approveSimulated() {
    if (!preview || !simulated || !consented) return;
    const sandboxRef = sanitize(
      `${preview.totalAmountUsd}-${preview.totalExpectedYieldUsd}-${preview.walletAddress}`
    );
    setReceipt({
      status: "prepared_not_broadcast",
      transactionType: preview.transactionType,
      walletAddress: preview.walletAddress,
      network: preview.network,
      steps: preview.steps.length,
      totalAmountUsd: preview.totalAmountUsd,
      totalExpectedYieldUsd: preview.totalExpectedYieldUsd,
      sandboxRef,
      warnings: preview.warnings,
    });
  }

  return (
    <div className="mt-4">
      {!preview && (
        <button
          type="button"
          onClick={prepare}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-5 py-2.5 text-sm font-semibold text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Spinner className="size-4" /> Preparing…
            </>
          ) : (
            "Prepare transaction (preview)"
          )}
        </button>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-300">
          {error} Nothing was attempted, signed or broadcast.
        </p>
      )}

      {preview && !receipt && (
        <Card className="mt-4 border-amber-500/30">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-zinc-100">
              Transaction preview
            </p>
            <div className="flex items-center gap-2">
              <Badge tone="warning">Sandbox</Badge>
              <Badge tone="danger">Not executed</Badge>
            </div>
          </div>

          <p className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-200">
            {preview.disclaimer}
          </p>

          {/* Required on-chain context */}
          <div className="mb-4 grid gap-3 text-sm sm:grid-cols-2">
            <Field label="Network" value={`${preview.network.name} · Chain ${preview.network.chainId}`} />
            <Field label="Transaction type" value={preview.transactionType} />
            <Field
              label="Wallet address"
              value={preview.walletAddress}
              mono
            />
            <Field
              label="Estimated result"
              value={preview.summary}
            />
          </div>

          {/* Steps */}
          <ul className="divide-y divide-zinc-800">
            {preview.steps.map((s) => (
              <li key={s.sequence} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-zinc-100">
                    <span className="mr-2 font-mono text-zinc-500">
                      {String(s.sequence).padStart(2, "0")}
                    </span>
                    {s.type} · {s.protocol} {s.asset}
                    <span className="ml-2 text-xs font-normal text-zinc-500">
                      {s.chain}
                    </span>
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm tabular-nums text-zinc-200">
                      {formatUsd(s.amountUsd)}
                    </span>
                    <Badge tone={RISK_TONE[s.riskLevel] ?? "default"}>
                      {s.riskLevel}
                    </Badge>
                  </div>
                </div>
                <p className="mt-1 text-xs text-zinc-500">{s.estimatedResultUsd}</p>
              </li>
            ))}
          </ul>

          {/* Warnings */}
          <div className="mt-3 space-y-1.5 rounded-lg bg-zinc-950/50 p-3">
            {preview.warnings.map((w) => (
              <p key={w} className="text-xs text-amber-300/80">
                ⚠ {w}
              </p>
            ))}
          </div>

          {/* Explicit consent */}
          <div className="mt-4 space-y-2">
            <label className="flex cursor-pointer items-start gap-2 text-xs text-zinc-400">
              <input
                type="checkbox"
                checked={simulated}
                onChange={(e) => setSimulated(e.target.checked)}
                className="mt-0.5 accent-cyan-400"
              />
              I understand this is a <strong className="text-zinc-200">simulated</strong>{" "}
              transaction on a sandbox network — nothing will be signed or broadcast.
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-xs text-zinc-400">
              <input
                type="checkbox"
                checked={consented}
                onChange={(e) => setConsented(e.target.checked)}
                className="mt-0.5 accent-cyan-400"
              />
              I approve this prepared transaction plan and accept the risks shown above.
            </label>
          </div>

          <button
            type="button"
            onClick={approveSimulated}
            disabled={!simulated || !consented}
            className={cn(
              "mt-4 w-full rounded-xl px-5 py-3 text-sm font-semibold transition",
              simulated && consented
                ? "bg-gradient-to-r from-emerald-400 to-cyan-500 text-zinc-950 hover:brightness-110"
                : "cursor-not-allowed bg-zinc-800 text-zinc-500"
            )}
          >
            {simulated && consented
              ? "Approve transaction (simulated)"
              : "Mark both boxes to approve"}
          </button>
        </Card>
      )}

      {receipt && (
        <Card className="mt-4 border-emerald-500/30">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-emerald-300">
              Prepared — nothing broadcast
            </p>
            <Badge tone="success">User-approved (simulated)</Badge>
          </div>
          <dl className="mb-3 grid gap-3 text-sm sm:grid-cols-2">
            <Field label="Transaction type" value={receipt.transactionType} />
            <Field label="Network" value={`${receipt.network.name} · ${receipt.network.chainId}`} />
            <Field label="Wallet" value={receipt.walletAddress} mono />
            <Field
              label="Estimated result"
              value={`${receipt.steps} step(s) · deploy ${formatUsd(
                receipt.totalAmountUsd
              )} · ≈${formatUsd(receipt.totalExpectedYieldUsd)}/yr`}
            />
          </dl>
          <p className="rounded-lg bg-zinc-950/60 p-3 font-mono text-xs text-zinc-500">
            sandbox ref: <span className="text-zinc-300">{receipt.sandboxRef}</span>
          </p>
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-zinc-800 pt-3 text-xs">
            <span className="text-zinc-500">
              AI recommendation ≠ executed transaction. This receipt proves the
              plan was approved in-sandbox only.
            </span>
            <button
              type="button"
              onClick={() => {
                setPreview(null);
                setReceipt(null);
                setSimulated(false);
                setConsented(false);
              }}
              className="shrink-0 rounded-lg border border-zinc-700 px-3 py-1.5 text-zinc-300 transition hover:bg-zinc-800"
            >
              Re-prepare
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 text-sm text-zinc-200",
          mono && "break-all font-mono text-xs"
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function sanitize(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, "0");
  return `0xsandbox${hex.slice(0, 6)}${hex.slice(0, 4)}...`;
}