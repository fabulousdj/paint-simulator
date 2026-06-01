import { describe, expect, it } from "vitest";
import { composeExportImage, createExportFilename } from "../utils/export";

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

describe("composeExportImage", () => {
  it("exports working image dimensions", () => {
    const source = new ImageData(new Uint8ClampedArray([1, 2, 3, 255, 4, 5, 6, 255]), 2, 1);
    const result = new Uint8ClampedArray([10, 20, 30, 255, 40, 50, 60, 255]);
    const output = composeExportImage({ sourceImageData: source, resultImageData: result, mask: new Uint8ClampedArray([255, 0]) });

    expect(output.width).toBe(2);
    expect(output.height).toBe(1);
  });

  it("uses result pixels only where the mask is active", () => {
    const source = new ImageData(new Uint8ClampedArray([1, 2, 3, 255, 4, 5, 6, 255, 7, 8, 9, 255]), 3, 1);
    const result = new Uint8ClampedArray([10, 20, 30, 255, 40, 50, 60, 255, 70, 80, 90, 255]);
    const output = composeExportImage({ sourceImageData: source, resultImageData: result, mask: new Uint8ClampedArray([0, 255, 0]) });

    expect(Array.from(output.data)).toEqual([1, 2, 3, 255, 40, 50, 60, 255, 7, 8, 9, 255]);
  });

  it("supports ImageData mask alpha", () => {
    const source = new ImageData(new Uint8ClampedArray([1, 2, 3, 255]), 1, 1);
    const result = new Uint8ClampedArray([10, 20, 30, 255]);
    const mask = new ImageData(new Uint8ClampedArray([0, 0, 0, 255]), 1, 1);

    expect(Array.from(composeExportImage({ sourceImageData: source, resultImageData: result, mask }).data)).toEqual([10, 20, 30, 255]);
  });

  it("throws when result pixels are unavailable", () => {
    const source = new ImageData(new Uint8ClampedArray([1, 2, 3, 255]), 1, 1);
    expect(() => composeExportImage({ sourceImageData: source, resultImageData: null, mask: new Uint8ClampedArray([255]) })).toThrow(
      "Export requires simulated result pixels."
    );
  });
});

describe("createExportFilename", () => {
  it("creates a deterministic PNG filename from a date", () => {
    expect(createExportFilename(new Date(2026, 0, 2, 3, 4, 5))).toBe("chromamatch-preview-20260102-030405.png");
  });
});
