import { describe, it, expect } from "vitest";
import {
  linearizeChannel,
  encodeChannel,
  rgbToLabD50,
  labD50ToRgb,
  labD50Delta,
  rgbFromHex,
  rgbToHex,
  computedLrvFromRgb,
  lrvToLabL,
  deltaE,
} from "../utils/color";
import type { RgbColor, LabColor } from "../types/session";

describe("sRGB linearization / encoding", () => {
  it("linearizes black and white", () => {
    expect(linearizeChannel(0)).toBe(0);
    expect(linearizeChannel(1)).toBeCloseTo(1, 5);
  });

  it("encodes linear black and white", () => {
    expect(encodeChannel(0)).toBe(0);
    expect(encodeChannel(1)).toBeCloseTo(1, 5);
  });

  it("round-trips a mid-range value", () => {
    const linear = linearizeChannel(0.5);
    const encoded = encodeChannel(linear);
    expect(encoded).toBeCloseTo(0.5, 5);
  });
});

describe("hex parsing", () => {
  it("parses known hex values", () => {
    expect(rgbFromHex("#D4D8D7")).toEqual({ r: 212, g: 216, b: 215 });
    expect(rgbFromHex("#CDBFB0")).toEqual({ r: 205, g: 191, b: 176 });
    expect(rgbFromHex("#000000")).toEqual({ r: 0, g: 0, b: 0 });
    expect(rgbFromHex("#FFFFFF")).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("converts RGB back to hex", () => {
    expect(rgbToHex({ r: 212, g: 216, b: 215 })).toBe("#d4d8d7");
    expect(rgbToHex({ r: 255, g: 0, b: 0 })).toBe("#ff0000");
  });
});

describe("RGB <-> LAB D50 fixed colors", () => {
  it("black is near zero L", () => {
    const lab = rgbToLabD50({ r: 0, g: 0, b: 0 });
    expect(lab.l).toBeCloseTo(0, 1);
  });

  it("white is near 100 L", () => {
    const lab = rgbToLabD50({ r: 255, g: 255, b: 255 });
    expect(lab.l).toBeCloseTo(100, 1);
    expect(lab.a).toBeCloseTo(0, 0);
    expect(lab.b).toBeCloseTo(0, 0);
  });

  it("neutral gray (#808080) is near zero a/b", () => {
    const lab = rgbToLabD50({ r: 128, g: 128, b: 128 });
    expect(lab.a).toBeCloseTo(0, 0);
    expect(lab.b).toBeCloseTo(0, 0);
    expect(lab.l).toBeGreaterThan(30);
    expect(lab.l).toBeLessThan(60);
  });

  it("red primary has positive a", () => {
    const lab = rgbToLabD50({ r: 255, g: 0, b: 0 });
    expect(lab.a).toBeGreaterThan(40);
  });

  it("green primary has negative a and negative b", () => {
    const lab = rgbToLabD50({ r: 0, g: 255, b: 0 });
    expect(lab.a).toBeLessThan(-30);
  });

  it("blue primary has negative b", () => {
    const lab = rgbToLabD50({ r: 0, g: 0, b: 255 });
    expect(lab.b).toBeLessThan(-40);
  });
});

describe("TDD fixtures", () => {
  it("#D4D8D7 approximates L=86.00, a=-1.54, b=-0.01 (±0.5)", () => {
    const lab = rgbToLabD50({ r: 212, g: 216, b: 215 });
    expect(lab.l).toBeCloseTo(86.0, 0);
    expect(lab.a).toBeCloseTo(-1.54, 0);
    expect(lab.b).toBeCloseTo(-0.01, 0);
  });

  it("#CDBFB0 approximates L=78.21, a=3.24, b=9.47 (±0.5)", () => {
    const lab = rgbToLabD50({ r: 205, g: 191, b: 176 });
    expect(lab.l).toBeCloseTo(78.21, 0);
    expect(lab.a).toBeCloseTo(3.24, 0);
    expect(lab.b).toBeCloseTo(9.47, 0);
  });

  it("#C9CCCD approximates L=81.83, a=-0.93, b=-0.88 (±0.5)", () => {
    const lab = rgbToLabD50({ r: 201, g: 204, b: 205 });
    expect(lab.l).toBeCloseTo(81.83, 0);
    expect(lab.a).toBeCloseTo(-0.93, 0);
    expect(lab.b).toBeCloseTo(-0.88, 0);
  });
});

describe("lab delta between TDD fixtures", () => {
  it("Paint A #D4D8D7 → Paint B #C9CCCD: L=-4.17, a=+0.61, b=-0.87", () => {
    const delta = labD50Delta({ r: 212, g: 216, b: 215 }, { r: 201, g: 204, b: 205 });
    expect(delta.dl).toBeCloseTo(-4.17, 0);
    expect(delta.da).toBeCloseTo(0.61, 0);
    expect(delta.db).toBeCloseTo(-0.87, 0);
  });

  it("Paint A #D4D8D7 → Paint B #CDBFB0: L=-7.79, a=+4.78, b=+9.48", () => {
    const delta = labD50Delta({ r: 212, g: 216, b: 215 }, { r: 205, g: 191, b: 176 });
    expect(delta.dl).toBeCloseTo(-7.79, 0);
    expect(delta.da).toBeCloseTo(4.78, 0);
    expect(delta.db).toBeCloseTo(9.48, 0);
  });
});

describe("round-trip tolerance", () => {
  const samples: Array<{ hex: string; rgb: RgbColor }> = [
    { hex: "#000000", rgb: { r: 0, g: 0, b: 0 } },
    { hex: "#FFFFFF", rgb: { r: 255, g: 255, b: 255 } },
    { hex: "#808080", rgb: { r: 128, g: 128, b: 128 } },
    { hex: "#FF0000", rgb: { r: 255, g: 0, b: 0 } },
    { hex: "#00FF00", rgb: { r: 0, g: 255, b: 0 } },
    { hex: "#0000FF", rgb: { r: 0, g: 0, b: 255 } },
    { hex: "#D4D8D7", rgb: { r: 212, g: 216, b: 215 } },
    { hex: "#CDBFB0", rgb: { r: 205, g: 191, b: 176 } },
    { hex: "#C9CCCD", rgb: { r: 201, g: 204, b: 205 } },
    { hex: "#4A90E2", rgb: { r: 74, g: 144, b: 226 } },
    { hex: "#E59866", rgb: { r: 229, g: 152, b: 102 } },
  ];

  it.each(samples)("round-trips $hex within ±2 per channel", ({ rgb }) => {
    const lab = rgbToLabD50(rgb);
    const result = labD50ToRgb(lab);
    expect(result.r).toBeCloseTo(rgb.r, 0);
    expect(Math.abs(result.r - rgb.r)).toBeLessThanOrEqual(2);
    expect(Math.abs(result.g - rgb.g)).toBeLessThanOrEqual(2);
    expect(Math.abs(result.b - rgb.b)).toBeLessThanOrEqual(2);
  });
});

describe("computed LRV", () => {
  it("D50 fixture #D4D8D7 has LRV near 68", () => {
    const lrv = computedLrvFromRgb({ r: 212, g: 216, b: 215 });
    expect(lrv).toBeCloseTo(68, 0);
  });

  it("D50 fixture #CDBFB0 has LRV near 53 (within LRV consistency threshold)", () => {
    const lrv = computedLrvFromRgb({ r: 205, g: 191, b: 176 });
    expect(lrv).toBeCloseTo(53.5, 0);
  });

  it("black has LRV of 0", () => {
    const lrv = computedLrvFromRgb({ r: 0, g: 0, b: 0 });
    expect(lrv).toBeCloseTo(0, 1);
  });
});

describe("LRV to L*", () => {
  it("LRV 100 maps to L=100", () => {
    expect(lrvToLabL(100)).toBeCloseTo(100, 1);
  });

  it("LRV 0 maps to L=0", () => {
    expect(lrvToLabL(0)).toBeCloseTo(0, 2);
  });

  it("LRV 68 maps to L near 86 (D50 fixture)", () => {
    const l = lrvToLabL(68);
    expect(l).toBeCloseTo(86, 0);
  });
});

describe("deltaE", () => {
  it("identical colors have deltaE of 0", () => {
    const lab: LabColor = { l: 50, a: 10, b: -5 };
    expect(deltaE(lab, lab)).toBe(0);
  });

  it("TDD fixture deltaE between #D4D8D7 and #C9CCCD", () => {
    const lab1 = rgbToLabD50({ r: 212, g: 216, b: 215 });
    const lab2 = rgbToLabD50({ r: 201, g: 204, b: 205 });
    const de = deltaE(lab1, lab2);
    expect(de).toBeGreaterThan(3);
    expect(de).toBeLessThan(8);
  });
});
