import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { chainCfg, deployment, resolveInstance } from "@/lib/chain";
import rule from "@/data/rule.json";

export const dynamic = "force-dynamic";
export const metadata = { title: "The rule and the keys · OpenTally" };

const KEYS = [
  { role: "Funder", holds: "the programme's funder", can: "deposit grant money into the escrow", cannot: "release, hold or change the rule" },
  { role: "Site gateway (one per site)", holds: "the site's metering gateway", can: "sign that site's monthly summaries", cannot: "sign for another site, change the rule or move money" },
  { role: "Verifier", holds: "the independent verification agent", can: "hold and lift a connection", cannot: "release money or withdraw the escrow" },
  { role: "Programme operator", holds: "the programme manager", can: "register sites and connections, submit signed summaries", cannot: "forge a site's signature, pay a held connection, pay twice, or release before the window closes" },
  { role: "Anyone", holds: "no key at all", can: "trigger the release once the sampling window has closed, and re-add every total", cannot: "choose who is paid: the rule decides" },
];

export default async function RulePage() {
  const picked = await resolveInstance().catch(() => null);
  const ex = chainCfg.explorer;
  const addr = (a: string) => ex ? <a className="font-mono" href={`${ex}/address/${a}`} target="_blank" rel="noreferrer">{a}</a> : <span className="font-mono">{a}</span>;
  return (
    <>
      <TopBar network={chainCfg.label} short={chainCfg.short} />
      <main className="w-full max-w-[960px] mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">
        <section className="flex flex-col gap-3">
          <h1 className="font-display font-semibold text-[32px] tracking-tight">The rule the contract runs</h1>
          <p className="font-display text-xl leading-relaxed m-0">{rule.sentence.before} {rule.parameters[0].label} {rule.sentence.between1} {rule.parameters[1].label}, {rule.sentence.between2} {rule.parameters[2].label} {rule.sentence.after}</p>
          <p className="text-sm text-ink-muted m-0">Source: <a href={rule.source.url} target="_blank" rel="noreferrer">{rule.source.name}</a>, read {rule.source.read}.</p>
        </section>
        <section className="flex flex-col gap-3" aria-labelledby="params">
          <h2 id="params" className="text-lg font-semibold">Parameters</h2>
          <div className="overflow-x-auto" role="region" aria-labelledby="params" tabIndex={0}>
            <table className="w-full text-sm border-collapse">
              <thead><tr className="text-left text-ink-muted"><th className="py-2 pr-4 font-medium">Parameter</th><th className="py-2 pr-4 font-medium">Value</th><th className="py-2 font-medium">Where it comes from</th></tr></thead>
              <tbody>
                {rule.parameters.map((p) => (
                  <tr key={p.key} className="border-t border-line align-top">
                    <td className="py-2.5 pr-4">{p.label}</td>
                    <td className="py-2.5 pr-4 tabular whitespace-nowrap">{p.value} {p.unit}{p.demoValue ? ` (${p.demoValue} on this demo)` : ""}{p.chosen ? <span className="block text-[13px] text-warning font-semibold">chosen by this team</span> : null}</td>
                    <td className="py-2.5">{p.source}</td>
                  </tr>
                ))}
                <tr className="border-t border-line align-top"><td className="py-2.5 pr-4">Grant per connection</td><td className="py-2.5 pr-4 tabular">{rule.grant.tusd} tUSD</td><td className="py-2.5">{rule.grant.source}</td></tr>
              </tbody>
            </table>
          </div>
        </section>
        <section className="flex flex-col gap-3" aria-labelledby="keys">
          <h2 id="keys" className="text-lg font-semibold">Who holds which key</h2>
          <div className="overflow-x-auto" role="region" aria-labelledby="keys" tabIndex={0}>
            <table className="w-full text-sm border-collapse">
              <thead><tr className="text-left text-ink-muted"><th className="py-2 pr-4 font-medium">Key</th><th className="py-2 pr-4 font-medium">Held by</th><th className="py-2 pr-4 font-medium">Can</th><th className="py-2 font-medium">Cannot</th></tr></thead>
              <tbody>{KEYS.map((k) => <tr key={k.role} className="border-t border-line align-top"><td className="py-2.5 pr-4 font-medium">{k.role}</td><td className="py-2.5 pr-4">{k.holds}</td><td className="py-2.5 pr-4">{k.can}</td><td className="py-2.5">{k.cannot}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="text-sm text-ink-muted m-0">On this demo one server holds all of these keys so that nobody needs a wallet to try it. A real programme gives each key to its holder: the funder&apos;s custody, the gateway hardware, the verifier&apos;s own signer.</p>
          <p className="text-sm m-0">What the chain proves: each summary was signed by its site&apos;s gateway key, every release followed the rule and skipped every hold, and nobody was paid twice. What it cannot prove: that a meter reported the truth. That is what the screen and the verifier&apos;s sampling are for.</p>
        </section>
        <section className="flex flex-col gap-2 text-sm" aria-labelledby="contracts">
          <h2 id="contracts" className="text-lg font-semibold">Contracts on {chainCfg.label}</h2>
          <p className="m-0">Programme shown on the tally: {picked ? addr(picked.shown.address) : "not reachable right now"}</p>
          <p className="m-0">Factory: {addr(deployment.factory)}</p>
          <p className="m-0">Test token (tUSD, no value): {addr(deployment.token)}</p>
          <Link href="/" className="font-semibold mt-2">Back to the tally</Link>
        </section>
      </main>
    </>
  );
}
