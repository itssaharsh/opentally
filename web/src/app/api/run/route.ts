import { runMonth } from "@/lib/pipeline";
import { instanceAddress } from "@/lib/chain";
import { acquireRun, releaseRun, allow } from "@/lib/limiter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!allow(`run:${ip}`, 3, 10 * 60_000)) return new Response("Too many runs from this address; try again in a few minutes.", { status: 429 });
  const instance = instanceAddress();
  if (!acquireRun(instance)) return new Response("A release is already running on this programme; wait for it to finish.", { status: 429 });
  const url = new URL(req.url);
  const month = Number(url.searchParams.get("month") ?? 4);
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        for await (const ev of runMonth(month)) send(ev);
        send({ step: 0, name: "end", status: "done", at: Date.now() });
      } catch (e) {
        send({ step: 0, name: "end", status: "failed", detail: (e as Error).message.split("\n")[0], at: Date.now() });
      } finally {
        releaseRun();
        controller.close();
      }
    },
    cancel() { releaseRun(); },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive" } });
}
