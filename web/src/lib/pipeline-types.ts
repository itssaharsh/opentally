export type StepEvent = {
  step: number; name: string; status: "running" | "done" | "failed" | "waiting";
  detail?: string; count?: number; txHash?: string; gasUsed?: number; secondsLeft?: number; at: number;
};
