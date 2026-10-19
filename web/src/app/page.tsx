import { readState, chainCfg, DEMO_MONTH, type PageState } from "@/lib/chain";
import { TopBar } from "@/components/TopBar";
import { Tally } from "@/components/Tally";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const judgeCard = sp.judge !== "0";
  const programme = typeof sp.programme === "string" ? sp.programme : null;
  let state: PageState | null = null; let error: string | null = null;
  try { state = await readState(DEMO_MONTH, programme); } catch (e) { error = (e as Error).message.split("\n")[0]; }
  return (
    <>
      <TopBar network={chainCfg.label} short={chainCfg.short} />
      <Tally initial={state} error={error} demoMonth={DEMO_MONTH} judgeCard={judgeCard} />
    </>
  );
}
