import { readState, deployment, DEMO_MONTH } from "@/lib/chain";
import { TopBar } from "@/components/TopBar";
import { Tally } from "@/components/Tally";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const judgeCard = sp.judge !== "0";
  let state = null; let error: string | null = null;
  try { state = await readState(DEMO_MONTH); } catch (e) { error = (e as Error).message.split("\n")[0]; }
  const network = deployment.chainId === 11155111 ? "Sepolia testnet" : "Local chain";
  return (
    <>
      <TopBar network={network} />
      <Tally initial={state} error={error} demoMonth={DEMO_MONTH} judgeCard={judgeCard} />
    </>
  );
}
