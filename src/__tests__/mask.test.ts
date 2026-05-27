import { describe, expect, it } from "vitest";
import {
  applyMaskBrush,
  applyMaskBrushInPlace,
  applyMaskStrokeInPlace,
  createMaskBuffer,
  hasMaskCoverage,
  resetMaskBuffer,
} from "../utils/mask";

describe("mask buffers", () => {
  it("creates one alpha byte per working pixel", () => {
    const mask = createMaskBuffer(4, 3);
    expect(mask).toHaveLength(12);
    expect([...mask]).toEqual(new Array(12).fill(0));
  });

  it("detects mask coverage", () => {
    const mask = createMaskBuffer(3, 3);
    expect(hasMaskCoverage(mask)).toBe(false);
    mask[4] = 1;
    expect(hasMaskCoverage(mask)).toBe(true);
  });

  it("paints a circular brush with opacity", () => {
    const mask = createMaskBuffer(7, 7);
    const next = applyMaskBrush(mask, 7, 7, {
      x: 3,
      y: 3,
      sizePx: 3,
      opacity: 0.5,
      mode: "paint",
    });

    expect(mask[3 * 7 + 3]).toBe(0);
    expect(next[3 * 7 + 3]).toBe(128);
    expect(next[0]).toBe(0);
  });

  it("does not reduce stronger existing paint with a weaker paint stroke", () => {
    const mask = createMaskBuffer(3, 3);
    mask[4] = 255;

    const next = applyMaskBrush(mask, 3, 3, {
      x: 1,
      y: 1,
      sizePx: 1,
      opacity: 0.25,
      mode: "paint",
    });

    expect(next[4]).toBe(255);
  });

  it("erases by opacity without underflow", () => {
    const mask = createMaskBuffer(3, 3);
    mask[4] = 100;

    const next = applyMaskBrush(mask, 3, 3, {
      x: 1,
      y: 1,
      sizePx: 1,
      opacity: 0.5,
      mode: "erase",
    });

    expect(next[4]).toBe(0);
  });

  it("clips strokes at image edges", () => {
    const mask = createMaskBuffer(2, 2);
    const next = applyMaskBrush(mask, 2, 2, {
      x: 0,
      y: 0,
      sizePx: 5,
      opacity: 1,
      mode: "paint",
    });

    expect([...next]).toEqual([255, 255, 255, 255]);
  });

  it("resets mask buffers", () => {
    const mask = resetMaskBuffer(2, 2);
    expect(mask).toHaveLength(4);
    expect(hasMaskCoverage(mask)).toBe(false);
  });

  it("mutates brush strokes in place and reports dirty bounds", () => {
    const mask = createMaskBuffer(4, 4);
    const dirty = applyMaskBrushInPlace(mask, 4, 4, {
      x: 1,
      y: 1,
      sizePx: 1,
      opacity: 1,
      mode: "paint",
    });

    expect(mask[1 * 4 + 1]).toBe(255);
    expect(mask[0]).toBe(0);
    expect(dirty).toEqual({ minX: 1, minY: 1, maxX: 1, maxY: 1 });
  });

  it("clips dirty bounds at image edges", () => {
    const mask = createMaskBuffer(2, 2);
    const dirty = applyMaskBrushInPlace(mask, 2, 2, {
      x: 0,
      y: 0,
      sizePx: 5,
      opacity: 1,
      mode: "paint",
    });

    expect([...mask]).toEqual([255, 255, 255, 255]);
    expect(dirty).toEqual({ minX: 0, minY: 0, maxX: 1, maxY: 1 });
  });

  it("interpolates stroke points so fast drags do not leave gaps", () => {
    const width = 15;
    const y = 2;
    const mask = createMaskBuffer(width, 5);
    const dirty = applyMaskStrokeInPlace(
      mask,
      width,
      5,
      { x: 1, y },
      { x: 13, y },
      { sizePx: 3, opacity: 1, mode: "paint" }
    );

    for (let x = 1; x <= 13; x += 1) {
      expect(mask[y * width + x]).toBeGreaterThan(0);
    }
    expect(dirty).toEqual({ minX: 0, minY: 1, maxX: 14, maxY: 3 });
  });
});
