/** Scale the desktop composition in CSS pixels, not physical monitor pixels.
 * Phones retain their touch-friendly responsive layout. Browser pinch zoom is
 * not observed or cancelled (we never use visualViewport.scale or device DPR).
 */
export function gameViewport(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { width: 1440, height: 810, scale: 1 };
  }
  const scale = width <= 900 ? 1 : Math.min(width / 1440, height / 810, 2.5);
  return { width: width / scale, height: height / scale, scale };
}
