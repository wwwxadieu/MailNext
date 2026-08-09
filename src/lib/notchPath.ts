export const NOTCH_HALF_HEIGHT = 30;
export const NOTCH_DEPTH = 26;
export const NOTCH_BUBBLE_SIZE = 44;

// Builds a CSS clip-path path() carving a smooth S-curve dip into the right edge
// of a `width` x `height` box, centered at `notchCenterY`. The command structure
// (M/H/V/C/C/V/H/Z) never changes shape across calls, only the numbers do, so the
// browser can transition smoothly between two calls' output via CSS `transition`.
export function buildNotchClipPath(width: number, height: number, notchCenterY: number): string {
  const w = Math.max(width, 0);
  const h = Math.max(height, notchCenterY + NOTCH_HALF_HEIGHT + 1, 1);
  const yTop = notchCenterY - NOTCH_HALF_HEIGHT;
  const yBot = notchCenterY + NOTCH_HALF_HEIGHT;
  const k = NOTCH_HALF_HEIGHT * 0.3;
  const innerK = NOTCH_HALF_HEIGHT * 0.85;
  const d = w - NOTCH_DEPTH;

  return (
    `path("M 0 0 H ${w} V ${yTop} ` +
    `C ${w} ${yTop + k}, ${d} ${notchCenterY - innerK}, ${d} ${notchCenterY} ` +
    `C ${d} ${notchCenterY + innerK}, ${w} ${yBot - k}, ${w} ${yBot} ` +
    `V ${h} H 0 Z")`
  );
}
