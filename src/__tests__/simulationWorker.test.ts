import { describe, expect, it } from "vitest";
import { isSimulationReady } from "../hooks/useSimulationWorker";
import { defaultSession, type PaintColor, type ProjectSession } from "../types/session";
import { rgbToLabD50 } from "../utils/color";

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

function paint(rgb: { r: number; g: number; b: number }): PaintColor {
  return {
    rgb,
    hex: "#000000",
    lrv: 50,
    labD50: rgbToLabD50(rgb),
    computedLrv: 50,
    lrvDelta: 0,
  };
}

function readySession(overrides: Partial<ProjectSession> = {}): ProjectSession {
  return {
    ...defaultSession,
    ...overrides,
    image: {
      ...defaultSession.image,
      sourceImageData: new ImageData(new Uint8ClampedArray([1, 2, 3, 255]), 1, 1),
      workingWidth: 1,
      workingHeight: 1,
      ...overrides.image,
    },
    maskImageData: overrides.maskImageData ?? new Uint8ClampedArray([255]),
    paintA: overrides.paintA === undefined ? paint({ r: 10, g: 10, b: 10 }) : overrides.paintA,
    paintB: overrides.paintB === undefined ? paint({ r: 20, g: 20, b: 20 }) : overrides.paintB,
  };
}

describe("isSimulationReady", () => {
  it("requires image, paints, and non-empty mask", () => {
    expect(isSimulationReady(defaultSession)).toBe(false);
    expect(isSimulationReady(readySession({ paintA: null }))).toBe(false);
    expect(isSimulationReady(readySession({ paintB: null }))).toBe(false);
    expect(isSimulationReady(readySession({ maskImageData: new Uint8ClampedArray([0]) }))).toBe(false);
    expect(isSimulationReady(readySession())).toBe(true);
  });
});
