import { readState, chainCfg, DEMO_MONTH, type PageState } from "@/lib/chain";
import { topUpSparesLater } from "@/lib/reset";
import { buildPreview, isPreview } from "@/lib/preview";
import { TopBar } from "@/components/TopBar";
import { Tally } from "@/components/Tally";

export const dynamic = "force-dynamic";

export const maxDuration = 300; // room for a background spare top-up after the page is sent

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const record = sp.record === "1";
  const judgeCard = sp.judge !== "0" && !record;
  const programme = typeof sp.programme === "string" ? sp.programme : null;
  let state: PageState | null = null; let error: string | null = null;
  try { state = await readState(DEMO_MONTH, programme); topUpSparesLater(state.spares); } catch (e) { error = (e as Error).message.split("\n")[0]; }
  const preview = state && isPreview(sp.state) ? buildPreview(sp.state, state) : null;
  return (
    <>
      <TopBar network={chainCfg.label} short={chainCfg.short} />
      <Tally key={preview?.name ?? "live"} initial={state} error={error} demoMonth={DEMO_MONTH} judgeCard={judgeCard} record={record} preview={preview} />
    </>
  );
}
