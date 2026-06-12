import { describe, expect, it } from "vitest";
import { bestMaskIndex, mergePromptMask, removePromptMask, tensorMaskToAlpha } from "../utils/wallSegmentation";

describe("wall segmentation utilities", () => {
  it("selects the highest-scored mask candidate", () => {
    expect(bestMaskIndex({ data: new Float32Array([0.2, 0.9, 0.4]) }, 3)).toBe(1);
  });

  it("converts the best tensor mask candidate to alpha", () => {
    const alpha = tensorMaskToAlpha(
      {
        dims: [1, 2, 2, 2],
        data: new Uint8Array([
          1, 0,
          0, 0,
          0, 1,
          1, 0,
        ]),
      },
      2,
      2,
      { data: new Float32Array([0.1, 0.8]) }
    );

    expect(Array.from(alpha)).toEqual([0, 255, 255, 0]);
  });

  it("merges prompt masks as full-strength coverage", () => {
    const next = mergePromptMask(
      new Uint8ClampedArray([0, 200, 0, 0]),
      new Uint8ClampedArray([255, 255, 0, 255])
    );

    expect(Array.from(next)).toEqual([255, 255, 0, 255]);
  });

  it("removes prompt mask coverage", () => {
    const next = removePromptMask(
      new Uint8ClampedArray([255, 200, 0, 128]),
      new Uint8ClampedArray([0, 255, 0, 255])
    );

    expect(Array.from(next)).toEqual([255, 0, 0, 0]);
  });
});
