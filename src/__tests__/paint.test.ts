import { describe, expect, it } from "vitest";
import { normalizePaintInput } from "../utils/paint";

describe("normalizePaintInput", () => {
  it("normalizes 6-digit hex with required LRV", () => {
    const result = normalizePaintInput({ hex: "D4D8D7", lrv: "68" });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected valid paint");
    expect(result.paint.hex).toBe("#d4d8d7");
    expect(result.paint.rgb).toEqual({ r: 212, g: 216, b: 215 });
    expect(result.paint.lrv).toBe(68);
    expect(result.paint.computedLrv).toBeCloseTo(68, 0);
    expect(result.paint.lrvDelta).toBeCloseTo(result.paint.computedLrv - 68, 5);
  });

  it("normalizes RGB whole-number channels through the same PaintColor path", () => {
    const result = normalizePaintInput({
      rgb: { r: "201", g: "204", b: "205" },
      lrv: "60.5",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected valid paint");
    expect(result.paint.hex).toBe("#c9cccd");
    expect(result.paint.rgb).toEqual({ r: 201, g: 204, b: 205 });
    expect(result.paint.lrv).toBe(60.5);
  });

  it("rejects invalid hex before conversion", () => {
    const result = normalizePaintInput({ hex: "#bad", lrv: "50" });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected invalid paint");
    expect(result.errors).toContainEqual({
      field: "color",
      message: "Use a 6-digit Hex value like #D4D8D7.",
    });
  });

  it("rejects invalid RGB channels", () => {
    const result = normalizePaintInput({
      rgb: { r: "1.5", g: "0", b: "256" },
      lrv: "50",
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected invalid paint");
    expect(result.errors).toContainEqual({
      field: "rgb",
      message: "RGB values must be whole numbers from 0 to 255.",
    });
  });

  it("requires LRV", () => {
    const result = normalizePaintInput({ hex: "#d4d8d7", lrv: "" });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected invalid paint");
    expect(result.errors).toContainEqual({
      field: "lrv",
      message: "Enter the paint's LRV from 0 to 100.",
    });
  });

  it("rejects out-of-range LRV", () => {
    const result = normalizePaintInput({ hex: "#d4d8d7", lrv: "101" });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected invalid paint");
    expect(result.errors).toContainEqual({
      field: "lrv",
      message: "LRV must be a number from 0 to 100.",
    });
  });

  it("warns only when LRV delta is strictly greater than 2", () => {
    const computed = normalizePaintInput({ hex: "#d4d8d7", lrv: "68" });
    expect(computed.ok).toBe(true);
    if (!computed.ok) throw new Error("expected valid paint");

    const exactThreshold = normalizePaintInput({
      hex: "#d4d8d7",
      lrv: String(computed.paint.computedLrv - 2),
    });
    const aboveThreshold = normalizePaintInput({
      hex: "#d4d8d7",
      lrv: String(computed.paint.computedLrv - 2.01),
    });

    expect(exactThreshold.ok).toBe(true);
    expect(aboveThreshold.ok).toBe(true);
    if (!exactThreshold.ok || !aboveThreshold.ok) throw new Error("expected valid paints");
    expect(exactThreshold.warnings).toEqual([]);
    expect(aboveThreshold.warnings[0]?.message).toContain("RGB-derived LRV differs");
  });

  it("keeps manual LRV validation-only and does not override RGB-derived LAB L", () => {
    const lowLrv = normalizePaintInput({ hex: "#d4d8d7", lrv: "10" });
    const highLrv = normalizePaintInput({ hex: "#d4d8d7", lrv: "90" });

    expect(lowLrv.ok).toBe(true);
    expect(highLrv.ok).toBe(true);
    if (!lowLrv.ok || !highLrv.ok) throw new Error("expected valid paints");
    expect(lowLrv.paint.labD50.l).toBeCloseTo(highLrv.paint.labD50.l, 5);
    expect(lowLrv.paint.lrv).toBe(10);
    expect(highLrv.paint.lrv).toBe(90);
  });
});
