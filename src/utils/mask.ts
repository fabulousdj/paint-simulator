import type { BrushState } from "../types/session";

export type MaskBrushOptions = BrushState & {
  x: number;
  y: number;
};

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function createMaskBuffer(width: number, height: number): Uint8ClampedArray {
  if (width <= 0 || height <= 0) return new Uint8ClampedArray(0);
  return new Uint8ClampedArray(width * height);
}

export function resetMaskBuffer(width: number, height: number): Uint8ClampedArray {
  return createMaskBuffer(width, height);
}

export function hasMaskCoverage(mask: Uint8ClampedArray | null | undefined): boolean {
  if (!mask) return false;
  for (let i = 0; i < mask.length; i += 1) {
    if ((mask[i] ?? 0) > 0) return true;
  }
  return false;
}

export function applyMaskBrush(
  mask: Uint8ClampedArray,
  width: number,
  height: number,
  options: MaskBrushOptions
): Uint8ClampedArray {
  const next = new Uint8ClampedArray(mask);
  if (width <= 0 || height <= 0 || next.length !== width * height) return next;

  const radius = Math.max(0.5, options.sizePx / 2);
  const opacityValue = clampByte(clampUnit(options.opacity) * 255);
  if (opacityValue <= 0) return next;

  const centerX = Math.round(options.x);
  const centerY = Math.round(options.y);
  const minX = Math.max(0, Math.floor(centerX - radius));
  const maxX = Math.min(width - 1, Math.ceil(centerX + radius));
  const minY = Math.max(0, Math.floor(centerY - radius));
  const maxY = Math.min(height - 1, Math.ceil(centerY + radius));
  const radiusSquared = radius * radius;

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = x - centerX;
      const dy = y - centerY;
      if (dx * dx + dy * dy > radiusSquared) continue;

      const index = y * width + x;
      const current = next[index] ?? 0;
      next[index] = options.mode === "erase"
        ? clampByte(current - opacityValue)
        : Math.max(current, opacityValue);
    }
  }

  return next;
}
