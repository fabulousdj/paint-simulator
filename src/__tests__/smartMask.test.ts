import { describe, expect, it } from "vitest";
import { applyPolygonToMask, edgeAwareAreaFill } from "../utils/smartMask";

class TestImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;

  constructor(data: Uint8ClampedArray, width: number, height?: number) {
    this.data = data;
    this.width = width;
    this.height = height ?? data.length / 4 / width;
  }
}

globalThis.ImageData ??= TestImageData as unknown as typeof ImageData;

function imageData(rows: number[][]): ImageData {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  const data = new Uint8ClampedArray(width * height * 4);
  rows.forEach((row, y) => {
    row.forEach((value, x) => {
      const offset = (y * width + x) * 4;
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    });
  });
  return new ImageData(data, width, height);
}

describe("edgeAwareAreaFill", () => {
  it("fills a contiguous similar area and stops at strong edges", () => {
    const source = imageData([
      [100, 102, 101, 220, 221],
      [99, 101, 100, 219, 220],
      [100, 100, 101, 218, 222],
    ]);
    const mask = new Uint8ClampedArray(source.width * source.height);

    const next = edgeAwareAreaFill({
      sourceImageData: source,
      mask,
      seed: { x: 1, y: 1 },
      mode: "add",
      colorTolerance: 8,
      edgeThreshold: 30,
    });

    expect(Array.from(next)).toEqual([
      255, 255, 255, 0, 0,
      255, 255, 255, 0, 0,
      255, 255, 255, 0, 0,
    ]);
    expect(source.data[0]).toBe(100);
  });

  it("removes a detected area", () => {
    const source = imageData([[50, 51, 200]]);
    const mask = new Uint8ClampedArray([255, 255, 255]);
    const next = edgeAwareAreaFill({
      sourceImageData: source,
      mask,
      seed: { x: 0, y: 0 },
      mode: "remove",
      colorTolerance: 5,
      edgeThreshold: 20,
    });

    expect(Array.from(next)).toEqual([0, 0, 255]);
  });
});

describe("applyPolygonToMask", () => {
  it("adds polygon coverage", () => {
    const mask = new Uint8ClampedArray(25);
    const next = applyPolygonToMask({
      mask,
      width: 5,
      height: 5,
      points: [
        { x: 1, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 4 },
        { x: 1, y: 4 },
      ],
      mode: "add",
    });

    expect(next[2 + 2 * 5]).toBe(255);
    expect(next[0]).toBe(0);
  });

  it("removes polygon coverage", () => {
    const mask = new Uint8ClampedArray(25).fill(255);
    const next = applyPolygonToMask({
      mask,
      width: 5,
      height: 5,
      points: [
        { x: 1, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 4 },
        { x: 1, y: 4 },
      ],
      mode: "remove",
    });

    expect(next[2 + 2 * 5]).toBe(0);
    expect(next[0]).toBe(255);
  });
});
