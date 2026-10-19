// ?state= previews for QA screenshots: each one is built from the real programme's data and is labelled on screen
// as a preview, so a screenshot of it can never pass for a run.
import type { PageState } from "./chain";
import type { StepEvent } from "./pipeline-types";

export const PREVIEW_STATES = ["first-run", "running", "released", "partial", "error"] as const;
export type PreviewName = (typeof PREVIEW_STATES)[number];
export type Preview = { name: PreviewName; state: PageState; events: StepEvent[]; running: boolean; runError: string | null; stale: string | null };

const HELD = new Set(["C-B07", "C-B14", "C-C03"]);
const NAMES = ["Verifying 50 site-signed summaries", "Screening traces against each site", "Applying the rule", "Checking the sampling window", "Sending the release"];
const ev = (step: number, status: StepEvent["status"], detail: string, extra: Partial<StepEvent> = {}): StepEvent => ({ step, name: NAMES[step - 1], status, detail, at: 0, ...extra });

export function isPreview(x: unknown): x is PreviewName { return typeof x === "string" && (PREVIEW_STATES as readonly string[]).includes(x); }

export function buildPreview(name: PreviewName, base: PageState): Preview {
  const s: PageState = JSON.parse(JSON.stringify(base));
  const doneSteps = [
    ev(1, "done", "50 of 50 verified on-chain; 1 summary rejected by the contract first: C-B14 was signed with site C's key (BadSignature), then re-signed with site B's key"),
    ev(2, "done", "3 held: C-B07 (identical to C-B14), C-B14 (identical to C-B07), C-C03 (flat)"),
    ev(3, "done", "47 eligible: active days and consumption meet the rule, not held, not yet paid"),
  ];
  const holdPlanted = () => s.sites.forEach((site) => site.connections.forEach((c) => { if (HELD.has(c.code)) { c.state = "held"; c.holdReason = c.code === "C-C03" ? 2 : 1; } }));
  const recount = () => s.sites.forEach((site) => {
    site.paid = site.connections.filter((c) => c.state === "paid").length; site.held = site.connections.filter((c) => c.state === "held").length;
    site.eligible = site.connections.filter((c) => c.state === "eligible").length; site.pending = site.connections.filter((c) => c.state === "pending").length;
  });
  if (name === "first-run") {
    s.sites.forEach((site) => site.connections.forEach((c) => { c.state = "pending"; c.summary = null; }));
    s.summaryMonth = 0; s.paidCount = 0; s.releases = []; s.lastReleased = null;
    recount();
    return { name, state: s, events: [], running: false, runError: null, stale: null };
  }
  if (name === "running") {
    holdPlanted(); recount();
    return { name, state: s, events: [...doneSteps, ev(4, "waiting", "the sampling window closes in 18 s (30 s on this demo instance; 14 days in the terms)", { secondsLeft: 18 })], running: true, runError: null, stale: null };
  }
  if (name === "released") {
    holdPlanted();
    s.sites.forEach((site) => site.connections.forEach((c) => { if (c.state === "eligible") { c.state = "paid"; c.paidMonth = 4; } }));
    recount();
    s.paidCount = 47; s.paidTotalTusd = 16450; s.escrowTusd = 1050; s.fresh = false;
    s.releases = [{ month: 4, count: 47, totalTusd: 16450, txHash: "0x" + "0".repeat(60) + "beef", blockNumber: 0, gasUsed: 936857 }];
    return { name, state: s, events: [...doneSteps, ev(4, "done", "closed; no hold outstanding on the eligible connections"), ev(5, "done", "47 connections released, 16450 tUSD")], running: false, runError: null, stale: null };
  }
  if (name === "partial") {
    return { name, state: s, events: [], running: false, runError: null, stale: "fetch failed" };
  }
  // error
  holdPlanted(); recount();
  return { name, state: s, events: [...doneSteps, ev(4, "done", "closed; no hold outstanding on the eligible connections"), ev(5, "failed", "the release reverted: InsufficientEscrow; nothing moved")], running: false, runError: "The release reverted: InsufficientEscrow. Nothing moved. Retry when ready.", stale: null };
}
