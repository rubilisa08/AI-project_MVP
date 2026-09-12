/** Manual analysis time this MVP compares itself against — the "8시간" baseline the product targets replacing. */
export const MANUAL_BASELINE_HOURS = 8;

export function formatDuration(ms: number): string {
  if (ms < 1000) return "1초 미만";
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}초`;
  return `${minutes}분 ${seconds}초`;
}

export function computeSavingsPercent(processingTimeMs: number): number {
  const baselineMs = MANUAL_BASELINE_HOURS * 60 * 60 * 1000;
  if (baselineMs <= 0) return 0;
  const savings = ((baselineMs - processingTimeMs) / baselineMs) * 100;
  return Math.max(0, Math.min(100, Math.round(savings * 10) / 10));
}
