import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({
  title,
  subtitle,
  eyebrow,
  action,
  className,
  children,
}: {
  title?: string;
  subtitle?: string;
  eyebrow?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 sm:p-6",
        className
      )}
    >
      {(title || subtitle || action) && (
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            {eyebrow && (
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                {eyebrow}
              </p>
            )}
            {title && (
              <h2 className="mt-1 text-sm font-semibold text-zinc-100">{title}</h2>
            )}
            {subtitle && <p className="mt-0.5 text-sm text-zinc-400">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}