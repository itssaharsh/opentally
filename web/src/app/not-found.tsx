import Link from "next/link";
export default function NotFound() {
  return (
    <main className="max-w-[680px] mx-auto px-6 py-24 flex flex-col gap-4">
      <h1 className="font-display font-semibold text-3xl">Nothing here</h1>
      <p className="text-ink-muted m-0">That page is not part of OpenTally, or that connection does not exist in this programme.</p>
      <Link href="/" className="font-semibold">Back to the tally</Link>
    </main>
  );
}
