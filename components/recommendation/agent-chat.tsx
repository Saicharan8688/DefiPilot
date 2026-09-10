"use client";

import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import type { Address, AgentAnswer, AgentAnswerSection, ApiResponse } from "@/lib/types";
import { Spinner } from "@/components/ui/spinner";

const SUGGESTIONS = [
  "Where should I put my idle USDC?",
  "Why are you recommending Aave?",
  "What happens if I allocate 50% instead?",
  "What is the riskiest option?",
  "How much yield could I potentially earn?",
  "What happens to my portfolio concentration?",
];

const TONE_BORDER: Record<NonNullable<AgentAnswerSection["tone"]>, string> = {
  default: "border-l-zinc-700",
  success: "border-l-emerald-400/70",
  warning: "border-l-amber-400/70",
  danger: "border-l-red-400/70",
};

/**
 * "Ask the agent" — answers every question through the deterministic math
 * engine (lib/ai/qa.ts) so figures are always computed, never generated.
 */
export function AgentChat({ address }: { address: Address }) {
  const [question, setQuestion] = useState("");
  const [thread, setThread] = useState<Array<{ question: string; answer: AgentAnswer | null }>>([]);

  const mutation = useMutation<AgentAnswer, Error, string>({
    mutationFn: async (q) => {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, question: q }),
      });
      const json = (await res.json()) as ApiResponse<AgentAnswer>;
      if (!res.ok || !json.success) {
        throw new Error(json.success ? "The agent did not answer." : json.error.message);
      }
      return json.data;
    },
  });

  function submit(q: string) {
    const trimmed = q.trim();
    if (!trimmed || mutation.isPending) return;
    setThread((t) => [...t, { question: trimmed, answer: null }]);
    setQuestion("");
    mutation.mutate(trimmed, {
      onSuccess: (answer) => {
        setThread((t) => {
          const next = [...t];
          const last = next[next.length - 1];
          if (last && last.question === trimmed && last.answer === null) {
            last.answer = answer;
          }
          return next;
        });
      },
      onError: () => {
        setThread((t) => {
          const next = [...t];
          const last = next[next.length - 1];
          if (last && last.question === trimmed && last.answer === null) {
            last.answer = {
              intent: "GENERAL",
              question: trimmed,
              source: "deterministic",
              dataProvidedAt: new Date().toISOString(),
              sections: [
                {
                  key: "risksWarnings",
                  heading: "Risks / warnings",
                  text: "The agent could not answer right now (data source unavailable). It won't guess — ask again in a moment.",
                  tone: "danger",
                },
              ],
              followUps: SUGGESTIONS,
              note: "No data was fabricated for this answer.",
            };
          }
          return next;
        });
      },
    });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    submit(question);
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-zinc-800 bg-zinc-900/60">
      <div className="border-b border-zinc-800 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">
          Ask the agent
        </p>
        <p className="mt-0.5 text-xs text-zinc-500">
          Deterministic math engine — every figure is computed, never guessed.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {thread.length === 0 && (
          <div className="space-y-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => submit(s)}
                className="block w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-left text-xs text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200"
              >
                “{s}”
              </button>
            ))}
          </div>
        )}

        {thread.map(({ question: q, answer }, i) => (
          <div key={`${q}-${i}`}>
            <p className="mb-2 rounded-lg rounded-br-none bg-zinc-800/80 px-3 py-2 text-sm text-zinc-100">
              {q}
            </p>
            {answer === null ? (
              <p className="flex items-center gap-2 px-1 py-2 text-xs text-zinc-500">
                <Spinner className="size-3.5" /> Reasoning over live data…
              </p>
            ) : (
              <AnswerBlock answer={answer} onFollowUp={submit} />
            )}
          </div>
        ))}
      </div>

      <form onSubmit={onSubmit} className="border-t border-zinc-800 p-3">
        <div className="flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about yields, risk, allocation…"
            maxLength={400}
            aria-label="Ask the agent a question"
            className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-400/60 focus:outline-none"
          />
          <button
            type="submit"
            disabled={mutation.isPending || question.trim().length === 0}
            className="shrink-0 rounded-lg bg-gradient-to-r from-emerald-400 to-cyan-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:brightness-110 disabled:opacity-40"
          >
            Ask
          </button>
        </div>
      </form>
    </div>
  );
}

function AnswerBlock({
  answer,
  onFollowUp,
}: {
  answer: AgentAnswer;
  onFollowUp: (q: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800">
      <div className="border-b border-zinc-800 bg-zinc-950/40 px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-300">
          {answer.intent.replaceAll("_", " ")}
        </span>
      </div>
      <div className="divide-y divide-zinc-800/70">
        {answer.sections.map((s) => (
          <div key={s.key} className={`border-l-2 ${TONE_BORDER[s.tone ?? "default"]} px-3 py-2.5`}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              {s.heading}
            </p>
            {s.text && <p className="mt-1 text-xs leading-relaxed text-zinc-300">{s.text}</p>}
            {s.bullets && s.bullets.length > 0 && (
              <dl className="mt-1.5 space-y-1">
                {s.bullets.map((b, i) => (
                  <div key={`${b.label}-${i}`} className="flex items-baseline justify-between gap-3 text-xs">
                    <dt className="shrink-0 text-zinc-500">{b.label}</dt>
                    <dd className="text-right tabular-nums text-zinc-200">{b.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        ))}
      </div>
      <div className="border-t border-zinc-800 bg-zinc-950/40 px-3 py-2">
        <p className="text-[10px] leading-relaxed text-zinc-500">{answer.note}</p>
      </div>
      <div className="flex flex-wrap gap-1.5 border-t border-zinc-800 px-3 py-2">
        {answer.followUps.slice(0, 3).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => onFollowUp(f)}
            className="rounded-full border border-zinc-800 px-2.5 py-1 text-[11px] text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200"
          >
            {f}
          </button>
        ))}
      </div>
    </div>
  );
}