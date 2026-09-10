"use client";

import { useState } from "react";

const LINKS = [
  { href: "#portfolio", label: "Analyze" },
  { href: "#opportunities", label: "Live scan" },
  { href: "#ai-analysis", label: "AI analysis" },
];

/** Mobile-only nav: hamburger toggles the section links (hidden on md+). */
export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Toggle navigation menu"
        className="grid size-9 place-items-center rounded-lg border border-zinc-800 text-zinc-300 transition hover:bg-zinc-800"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden
        >
          {open ? (
            <path d="M6 6l12 12M18 6L6 18" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" />
          )}
        </svg>
      </button>

      {open && (
        <nav className="absolute inset-x-0 top-16 z-50 border-b border-zinc-800 bg-zinc-950/95 px-4 py-3 backdrop-blur">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100"
            >
              {l.label}
            </a>
          ))}
        </nav>
      )}
    </div>
  );
}