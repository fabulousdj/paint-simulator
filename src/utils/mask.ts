import type { BrushState } from "../types/session";

export type MaskBrushOptions = BrushState & {
  x: number;
  y: number;
};

export type MaskPoint = {
  x: number;
  y: number;
};

export type DirtyBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function unionBounds(a: DirtyBounds | null, b: DirtyBounds | null): DirtyBounds | null {
  if (!a) return b;
  if (!b) return a;
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
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
  applyMaskBrushInPlace(next, width, height, options);
  return next;
}

export function applyMaskBrushInPlace(
  mask: Uint8ClampedArray,
  width: number,
  height: number,
  options: MaskBrushOptions
): DirtyBounds | null {
  if (width <= 0 || height <= 0 || mask.length !== width * height) return null;

  const radius = Math.max(0.5, options.sizePx / 2);
  const opacityValue = clampByte(clampUnit(options.opacity) * 255);
  if (opacityValue <= 0) return null;

  const centerX = Math.round(options.x);
  const centerY = Math.round(options.y);
  const minX = Math.max(0, Math.floor(centerX - radius));
  const maxX = Math.min(width - 1, Math.ceil(centerX + radius));
  const minY = Math.max(0, Math.floor(centerY - radius));
  const maxY = Math.min(height - 1, Math.ceil(centerY + radius));
  const radiusSquared = radius * radius;
  let dirty: DirtyBounds | null = null;

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = x - centerX;
      const dy = y - centerY;
      if (dx * dx + dy * dy > radiusSquared) continue;

      const index = y * width + x;
      const current = mask[index] ?? 0;
      const nextValue = options.mode === "erase"
        ? clampByte(current - opacityValue)
        : Math.max(current, opacityValue);
      if (nextValue === current) continue;

      mask[index] = nextValue;
      dirty = unionBounds(dirty, { minX: x, minY: y, maxX: x, maxY: y });
    }
  }

  return dirty;
}

export function applyMaskStrokeInPlace(
  mask: Uint8ClampedArray,
  width: number,
  height: number,
  from: MaskPoint,
  to: MaskPoint,
  brush: BrushState
): DirtyBounds | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  const step = Math.max(1, brush.sizePx / 4);
  const steps = Math.max(1, Math.ceil(distance / step));
  let dirty: DirtyBounds | null = null;

  for (let i = 0; i <= steps; i += 1) {
    const ratio = i / steps;
    dirty = unionBounds(
      dirty,
      applyMaskBrushInPlace(mask, width, height, {
        ...brush,
        x: from.x + dx * ratio,
        y: from.y + dy * ratio,
      })
    );
  }

  return dirty;
}
