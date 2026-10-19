import Link from "next/link";
import { Mark } from "./Mark";

export function TopBar({ network, short }: { network: string; short: string }) {
  return (
    <header className="h-14 px-4 sm:px-6 flex items-center gap-4 border-b border-line bg-canvas">
      <Link href="/" className="flex items-center gap-2.5 no-underline text-ink">
        <Mark />
        <span className="font-display font-semibold text-xl tracking-tight">OpenTally</span>
      </Link>
      <span className="hidden md:inline text-sm text-ink-muted">Mini-grid grants released by one public rule.</span>
      <span className="flex-1" />
      <Link href="/rule" className="text-sm px-2.5 py-2 rounded-md hover:bg-surface-2">Rule</Link>
      <Link href="/about" className="text-sm px-2.5 py-2 rounded-md hover:bg-surface-2">About</Link>
      <span className="text-[13px] font-semibold bg-surface-2 rounded-full px-3 py-1 whitespace-nowrap"><span className="sm:hidden">{short}</span><span className="hidden sm:inline">{network}</span></span>
    </header>
  );
}
