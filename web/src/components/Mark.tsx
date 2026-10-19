export function Mark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="OpenTally mark">
      <path d="M8 10v28M16 10v28M24 10v28M32 10v28" stroke="var(--ink)" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M4 36L40 12" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" fill="none" />
    </svg>
  );
}
