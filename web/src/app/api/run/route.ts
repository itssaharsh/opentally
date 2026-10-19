import { after } from "next/server";
import { runMonth } from "@/lib/pipeline";
import { instanceFor, invalidateInstance, UnknownProgramme } from "@/lib/chain";
import { acquireRun, releaseRun, allow, busyInstances } from "@/lib/limiter";
import { funds } from "@/lib/wallets";
import { ensureSpares } from "@/lib/reset";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!allow(`run:${ip}`, 3, 10 * 60_000)) return new Response("Too many runs from this address; try again in a few minutes.", { status: 429 });
  const url = new URL(req.url);
  const month = Number(url.searchParams.get("month") ?? 4);
  let inst: Awaited<ReturnType<typeof instanceFor>>;
  try { inst = await instanceFor(url.searchParams.get("programme")); }
  catch (e) { if (e instanceof UnknownProgramme) return new Response(e.message, { status: 400 }); throw e; }
  if (!inst.fresh) {
    if (busyInstances().has(inst.address.toLowerCase())) return new Response("A release is already running on this programme; wait for it to finish.", { status: 429 });
    return new Response("This programme has already been released. Open a fresh one from the first screen.", { status: 409 });
  }
  const f = await funds();
  if (!f.ok) return new Response(f.reason ?? "The demo wallet is low on test ETH.", { status: 503 });
  if (!acquireRun(inst.address)) return new Response("A release is already running on this programme; wait for it to finish.", { status: 429 });
  invalidateInstance();
  after(async () => { try { await ensureSpares(2); } catch { /* a spare that fails to seed is retried on the next run */ } });
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      send({ step: 0, name: "programme", status: "running", detail: inst.address, at: Date.now() });
      try {
        for await (const ev of runMonth(inst.address, month)) send(ev);
        send({ step: 0, name: "end", status: "done", at: Date.now() });
      } catch (e) {
        send({ step: 0, name: "end", status: "failed", detail: (e as Error).message.split("\n")[0], at: Date.now() });
      } finally {
        releaseRun(inst.address);
        invalidateInstance();
        controller.close();
      }
    },
    cancel() { releaseRun(inst.address); },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive" } });
}
