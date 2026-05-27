import { describe, expect, it } from "vitest";
import type { PaintColor } from "../types/session";
import { rgbToLabD50 } from "../utils/color";
import { simulatePaintTransfer } from "../utils/simulation";

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

function paint(hex: string, rgb: { r: number; g: number; b: number }): PaintColor {
  return {
    hex,
    rgb,
    lrv: 50,
    labD50: rgbToLabD50(rgb),
    computedLrv: 50,
    lrvDelta: 0,
  };
}

function imageData(pixels: number[], width = pixels.length / 4): ImageData {
  return new ImageData(new Uint8ClampedArray(pixels), width, pixels.length / 4 / width);
}

const paintA = paint("#D4D8D7", { r: 212, g: 216, b: 215 });
const paintB = paint("#C9CCCD", { r: 201, g: 204, b: 205 });

describe("simulatePaintTransfer", () => {
  it("defaults to LAB D50 delta mode", () => {
    const source = imageData([212, 216, 215, 255]);
    const result = simulatePaintTransfer({ sourceImageData: source, mask: new Uint8ClampedArray([255]), paintA, paintB });

    expect(result.metadata.mode).toBe("lab-delta-d50");
    expect(Array.from(result.imageData.data.slice(0, 3))).toEqual([201, 204, 205]);
  });

  it("leaves unmasked pixels unchanged", () => {
    const source = imageData([20, 30, 40, 128]);
    const result = simulatePaintTransfer({ sourceImageData: source, mask: new Uint8ClampedArray([0]), paintA, paintB });

    expect(Array.from(result.imageData.data)).toEqual([20, 30, 40, 128]);
    expect(result.metadata.affectedPixelCount).toBe(0);
  });

  it("blends partial mask values and preserves alpha", () => {
    const source = imageData([212, 216, 215, 77]);
    const result = simulatePaintTransfer({ sourceImageData: source, mask: new Uint8ClampedArray([128]), paintA, paintB });

    expect(Array.from(result.imageData.data)).toEqual([206, 210, 210, 77]);
  });

  it("affects masked pixels only in a multi-pixel image", () => {
    const source = imageData([212, 216, 215, 255, 10, 20, 30, 255], 2);
    const result = simulatePaintTransfer({ sourceImageData: source, mask: new Uint8ClampedArray([255, 0]), paintA, paintB });

    expect(Array.from(result.imageData.data)).toEqual([201, 204, 205, 255, 10, 20, 30, 255]);
  });

  it("tracks LAB clipping metadata", () => {
    const black = paint("#000000", { r: 0, g: 0, b: 0 });
    const white = paint("#FFFFFF", { r: 255, g: 255, b: 255 });
    const source = imageData([255, 255, 255, 255]);
    const result = simulatePaintTransfer({ sourceImageData: source, mask: new Uint8ClampedArray([255]), paintA: black, paintB: white });

    expect(result.metadata.clippedPixelCount).toBeGreaterThan(0);
    expect(result.metadata.clippedChannelCount).toBeGreaterThan(0);
  });

  it("supports RGB ratio debug mode without changing the default", () => {
    const source = imageData([100, 100, 100, 255]);
    const from = paint("#323232", { r: 50, g: 50, b: 50 });
    const to = paint("#646464", { r: 100, g: 100, b: 100 });
    const result = simulatePaintTransfer({
      sourceImageData: source,
      mask: new Uint8ClampedArray([255]),
      paintA: from,
      paintB: to,
      mode: "rgb-ratio-debug",
    });

    expect(result.metadata.mode).toBe("rgb-ratio-debug");
    expect(Array.from(result.imageData.data)).toEqual([200, 200, 200, 255]);
  });

  it("handles invalid mask size as a no-op", () => {
    const source = imageData([212, 216, 215, 255]);
    const result = simulatePaintTransfer({ sourceImageData: source, mask: new Uint8ClampedArray([]), paintA, paintB });

    expect(Array.from(result.imageData.data)).toEqual([212, 216, 215, 255]);
  });
});
