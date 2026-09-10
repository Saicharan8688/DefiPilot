import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "default" | "brand" | "success" | "warning" | "danger" | "outline";

const TONES: Record<Tone, string> = {
  default: "bg-zinc-800 text-zinc-200",
  brand: "bg-gradient-to-r from-emerald-400 to-cyan-500 text-zinc-950",
  success: "bg-emerald-500/15 text-emerald-300",
  warning: "bg-amber-500/15 text-amber-300",
  danger: "bg-red-500/15 text-red-300",
  outline: "border border-zinc-700 text-zinc-300",
};

export function Badge({
  tone = "default",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}