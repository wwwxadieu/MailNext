export const NOTCH_HALF_HEIGHT = 42;
export const NOTCH_DEPTH = 36;
export const NOTCH_BUBBLE_SIZE = 44;

// Builds a CSS clip-path path() carving a smooth S-curve dip into the right edge
// of a `width` x `height` box, centered at `notchCenterY`. The command structure
// (M/H/V/C/C/V/H/Z) never changes shape across calls, only the numbers do. `halfHeight`
// and `depth` can be pushed beyond their base constants to stretch the dip while it's
// in motion, then eased back to base once it settles — that stretch is what reads as
// "liquid" rather than a shape sliding to a new spot.
export function buildNotchClipPath(
  width: number,
  height: number,
  notchCenterY: number,
  halfHeight: number = NOTCH_HALF_HEIGHT,
  depth: number = NOTCH_DEPTH,
): string {
  const w = Math.max(width, 0);
  const h = Math.max(height, notchCenterY + halfHeight + 1, 1);
  const yTop = notchCenterY - halfHeight;
  const yBot = notchCenterY + halfHeight;
  const k = halfHeight * 0.3;
  const innerK = halfHeight * 0.85;
  const d = w - depth;

  return (
    `path("M 0 0 H ${w} V ${yTop} ` +
    `C ${w} ${yTop + k}, ${d} ${notchCenterY - innerK}, ${d} ${notchCenterY} ` +
    `C ${d} ${notchCenterY + innerK}, ${w} ${yBot - k}, ${w} ${yBot} ` +
    `V ${h} H 0 Z")`
  );
}
