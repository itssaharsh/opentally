import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { chainCfg } from "@/lib/chain";
import links from "@/data/links.json";

export const metadata = { title: "About · OpenTally" };

export default function AboutPage() {
  return (
    <>
      <TopBar network={chainCfg.label} short={chainCfg.short} />
      <main className="w-full max-w-[680px] mx-auto px-4 sm:px-6 py-10 flex flex-col gap-8" id="about">
        <section className="flex flex-col gap-3">
          <h1 className="font-display font-semibold text-[36px] leading-tight tracking-tight">Mini-grid grants released by one public rule.</h1>
          <p className="text-lg m-0">Each connection&apos;s site-signed monthly summary meets the programme&apos;s own rule on a public ledger; when the sampling window closes without a hold, the grant moves, and anyone can re-add the total.</p>
        </section>
        <section className="flex flex-col gap-2" aria-labelledby="proof">
          <h2 id="proof" className="text-lg font-semibold">What you can check</h2>
          <ul className="list-disc pl-5 m-0 flex flex-col gap-1.5">
            <li>One button releases 47 of 50 demo connections in one transaction on {chainCfg.label}, and the receipt links to it.</li>
            <li>The rule is quoted from the DARES verification terms; the one value the terms leave open is marked as a chosen parameter.</li>
            <li>Re-sum rebuilds the paid count and the amount from the release records, to the unit.</li>
          </ul>
        </section>
        <section className="flex flex-col gap-2" aria-labelledby="how">
          <h2 id="how" className="text-lg font-semibold">How it works</h2>
          <ol className="list-decimal pl-5 m-0 flex flex-col gap-1.5">
            <li>Sites sign monthly summaries.</li>
            <li>The rule and the sampling window decide; the verifier can hold.</li>
            <li>The contract releases; the page re-adds.</li>
          </ol>
        </section>
        <section className="flex flex-col gap-2" aria-labelledby="limits">
          <h2 id="limits" className="text-lg font-semibold">Limits</h2>
          <p className="m-0">The 50 connections, their traces and the three planted faults are synthetic. The release runs on a test network with a test token, signed by demo keys the server holds; a real programme gives each key to its holder. The screen is statistics, not a trained model, and it can only hold; its catch on three planted faults is an illustration, not an evaluation. Site visits and phone sampling are not built.</p>
        </section>
        <section className="flex flex-col gap-2" aria-labelledby="sources">
          <h2 id="sources" className="text-lg font-semibold">Why this exists</h2>
          <p className="m-0">The DARES verification terms tell the independent verifier to build its own dashboard and check it against three other tallies, and say its recommendations are not binding (<a href="https://nep.rea.gov.ng/assets/documents/resource-hub/ToR_for_IVA_North.pdf" target="_blank" rel="noreferrer">Rural Electrification Agency of Nigeria</a>). A study of thirteen results-based financing programmes asks for predictable, on-time disbursement (<a href="https://beyondthegrid.africa/wp-content/uploads/BGFA_Mini-grid_Spreads.pdf" target="_blank" rel="noreferrer">Beyond the Grid Fund for Africa and Nefco</a>).</p>
        </section>
        <section className="flex flex-wrap gap-3">
          <Link href="/" className="h-11 px-5 rounded-md bg-accent-strong text-accent-ink font-semibold inline-flex items-center no-underline">Try it live</Link>
          {links.video && <a href={links.video} className="h-11 px-5 rounded-md bg-surface-2 text-ink font-semibold inline-flex items-center no-underline" target="_blank" rel="noreferrer">Watch the demo{links.videoLength ? ` (${links.videoLength})` : ""}</a>}
          {links.repo && <a href={links.repo} className="h-11 px-5 rounded-md bg-surface-2 text-ink font-semibold inline-flex items-center no-underline" target="_blank" rel="noreferrer">View source</a>}
        </section>
      </main>
    </>
  );
}
