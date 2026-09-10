import Link from "next/link";
import { ConnectWallet } from "@/components/wallet/connect-wallet";
import { MobileNav } from "@/components/app/mobile-nav";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800/70 bg-zinc-950/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 font-bold text-zinc-950">
            D
          </span>
          <span className="text-base font-semibold tracking-tight text-zinc-100">
            DeFiPilot
          </span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-zinc-400 md:flex">
          <a href="#portfolio" className="transition hover:text-zinc-100">
            Analyze
          </a>
          <a href="#opportunities" className="transition hover:text-zinc-100">
            Live scan
          </a>
          <a href="#ai-analysis" className="transition hover:text-zinc-100">
            AI analysis
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <MobileNav />
          <ConnectWallet />
        </div>
      </div>
    </header>
  );
}