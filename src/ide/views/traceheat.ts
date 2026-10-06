// Map per-line execution counts to hot/cold heat levels for the
// "Highlight Executed Lines" overlay.

export const TRACED_HEAT_LEVELS = 4;

// Convert one count to a level 0..TRACED_HEAT_LEVELS-1, relative to the
// maximum count. Uses a log scale so a few very hot lines don't flatten
// everything else into the coldest bucket.
export function heatLevel(count: number, max: number): number {
  if (max <= 1 || count <= 1) return 0;
  const level = Math.round((Math.log(count) / Math.log(max)) * (TRACED_HEAT_LEVELS - 1));
  return Math.max(0, Math.min(TRACED_HEAT_LEVELS - 1, level));
}

// Compute hot/cold levels for lines in a set of execution counts.
// Levels are normalized against the maximum over ALL counts, so a line's
// color stays stable even when it isn't in the current update. If `visible`
// is given, only those lines are returned; the caller uses this to hide
// lines that haven't run since the last update.
export function computeHeatLevels(counts: Map<number, number>, visible?: Set<number>): { line: number, level: number }[] {
  let max = 0;
  for (const count of counts.values()) {
    if (count > max) max = count;
  }
  const lines: { line: number, level: number }[] = [];
  for (const [line, count] of counts) {
    if (visible && !visible.has(line)) continue;
    lines.push({ line, level: heatLevel(count, max) });
  }
  return lines;
}
