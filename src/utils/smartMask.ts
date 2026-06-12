export type SmartMaskPoint = {
  x: number;
  y: number;
};

export type MaskApplyMode = "add" | "remove";

export type EdgeAwareFillOptions = {
  sourceImageData: ImageData;
  mask: Uint8ClampedArray;
  seed: SmartMaskPoint;
  mode: MaskApplyMode;
  colorTolerance: number;
  edgeThreshold: number;
};

export type PolygonMaskOptions = {
  mask: Uint8ClampedArray;
  width: number;
  height: number;
  points: SmartMaskPoint[];
  mode: MaskApplyMode;
};

function pixelOffset(x: number, y: number, width: number): number {
  return (y * width + x) * 4;
}

function colorAt(data: Uint8ClampedArray, x: number, y: number, width: number) {
  const offset = pixelOffset(x, y, width);
  return {
    r: data[offset] ?? 0,
    g: data[offset + 1] ?? 0,
    b: data[offset + 2] ?? 0,
  };
}

function colorDistance(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function luma(color: { r: number; g: number; b: number }) {
  return 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
}

function applyMaskValue(mode: MaskApplyMode) {
  return mode === "add" ? 255 : 0;
}

export function edgeAwareAreaFill({
  sourceImageData,
  mask,
  seed,
  mode,
  colorTolerance,
  edgeThreshold,
}: EdgeAwareFillOptions): Uint8ClampedArray {
  const { width, height, data } = sourceImageData;
  const next = new Uint8ClampedArray(mask);
  if (width <= 0 || height <= 0 || mask.length !== width * height) return next;

  const seedX = Math.round(seed.x);
  const seedY = Math.round(seed.y);
  if (seedX < 0 || seedX >= width || seedY < 0 || seedY >= height) return next;

  const seedColor = colorAt(data, seedX, seedY, width);
  const visited = new Uint8Array(width * height);
  const queue: SmartMaskPoint[] = [{ x: seedX, y: seedY }];
  visited[seedY * width + seedX] = 1;

  for (let head = 0; head < queue.length; head += 1) {
    const point = queue[head];
    if (!point) continue;

    const currentColor = colorAt(data, point.x, point.y, width);
    if (colorDistance(currentColor, seedColor) > colorTolerance) continue;

    const maskIndex = point.y * width + point.x;
    next[maskIndex] = applyMaskValue(mode);

    const neighbors = [
      { x: point.x + 1, y: point.y },
      { x: point.x - 1, y: point.y },
      { x: point.x, y: point.y + 1 },
      { x: point.x, y: point.y - 1 },
    ];

    for (const neighbor of neighbors) {
      if (neighbor.x < 0 || neighbor.x >= width || neighbor.y < 0 || neighbor.y >= height) continue;
      const neighborIndex = neighbor.y * width + neighbor.x;
      if (visited[neighborIndex]) continue;
      visited[neighborIndex] = 1;

      const neighborColor = colorAt(data, neighbor.x, neighbor.y, width);
      const crossesStrongEdge =
        Math.abs(luma(neighborColor) - luma(currentColor)) > edgeThreshold ||
        colorDistance(neighborColor, currentColor) > edgeThreshold * 2;
      if (!crossesStrongEdge) queue.push(neighbor);
    }
  }

  return next;
}

function pointInPolygon(x: number, y: number, points: SmartMaskPoint[]) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const pi = points[i];
    const pj = points[j];
    if (!pi || !pj) continue;

    const intersects = pi.y > y !== pj.y > y &&
      x < ((pj.x - pi.x) * (y - pi.y)) / (pj.y - pi.y || Number.EPSILON) + pi.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function applyPolygonToMask({
  mask,
  width,
  height,
  points,
  mode,
}: PolygonMaskOptions): Uint8ClampedArray {
  const next = new Uint8ClampedArray(mask);
  if (width <= 0 || height <= 0 || mask.length !== width * height || points.length < 3) return next;

  const minX = Math.max(0, Math.floor(Math.min(...points.map((point) => point.x))));
  const maxX = Math.min(width - 1, Math.ceil(Math.max(...points.map((point) => point.x))));
  const minY = Math.max(0, Math.floor(Math.min(...points.map((point) => point.y))));
  const maxY = Math.min(height - 1, Math.ceil(Math.max(...points.map((point) => point.y))));

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (!pointInPolygon(x + 0.5, y + 0.5, points)) continue;
      const index = y * width + x;
      next[index] = applyMaskValue(mode);
    }
  }

  return next;
}
