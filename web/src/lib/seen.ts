// The newest block this browser has seen one of its own actions land in. Sent as a cookie so every server read
// (page render, /api/state, router.refresh) asks the RPC for at least that block, whichever server instance answers.
export const SEEN_COOKIE = "ot_at";
export function noteBlock(n: number | undefined) {
  if (!n || typeof document === "undefined") return;
  const cur = Number(document.cookie.match(/(?:^|; )ot_at=(\d+)/)?.[1] ?? 0);
  if (n > cur) document.cookie = `${SEEN_COOKIE}=${n}; path=/; max-age=900; samesite=lax`;
}
