import { describe, expect, it } from "vitest";
import { defaultSession, type PaintColor, type ProjectSession } from "../types/session";
import { getWorkflowReadiness } from "../utils/workflow";
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

function paint(hex: string, rgb: { r: number; g: number; b: number }, lrvDelta = 0): PaintColor {
  return {
    hex,
    rgb,
    lrv: 50,
    labD50: rgbToLabD50(rgb),
    computedLrv: 50 + lrvDelta,
    lrvDelta,
  };
}

function session(overrides: Partial<ProjectSession> = {}): ProjectSession {
  return {
    ...defaultSession,
    ...overrides,
    image: {
      ...defaultSession.image,
      sourceImageData: new ImageData(new Uint8ClampedArray([10, 20, 30, 255]), 1, 1),
      workingWidth: 1,
      workingHeight: 1,
      ...overrides.image,
    },
    paintA: overrides.paintA === undefined ? paint("#101010", { r: 16, g: 16, b: 16 }) : overrides.paintA,
    paintB: overrides.paintB === undefined ? paint("#202020", { r: 32, g: 32, b: 32 }) : overrides.paintB,
    maskImageData: overrides.maskImageData ?? new Uint8ClampedArray([255]),
  };
}

describe("workflow readiness", () => {
  it("reports all missing requirements from a blank session", () => {
    const readiness = getWorkflowReadiness(defaultSession);
    expect(readiness.canSimulate).toBe(false);
    expect(readiness.blockers.map((blocker) => blocker.id)).toEqual(["image", "paint-a", "paint-b", "mask"]);
  });

  it("blocks simulation when the mask is empty", () => {
    const readiness = getWorkflowReadiness(session({ maskImageData: new Uint8ClampedArray([0]) }));
    expect(readiness.canSimulate).toBe(false);
    expect(readiness.blockers).toContainEqual({ id: "mask", message: "Add a non-empty wall mask." });
  });

  it("allows simulation when image, paints, and non-empty mask are present", () => {
    const readiness = getWorkflowReadiness(session());
    expect(readiness.canSimulate).toBe(true);
    expect(readiness.blockers).toEqual([]);
  });

  it("does not block simulation for LRV mismatch warnings", () => {
    const readiness = getWorkflowReadiness(session({ paintA: paint("#101010", { r: 16, g: 16, b: 16 }, 8) }));
    expect(readiness.canSimulate).toBe(true);
  });

  it("requires a result before export", () => {
    const withoutResult = getWorkflowReadiness(session());
    expect(withoutResult.canExport).toBe(false);
    expect(withoutResult.exportBlockers.map((blocker) => blocker.id)).toEqual(["result"]);

    const withResult = getWorkflowReadiness(session({ resultImageData: new Uint8ClampedArray([20, 30, 40, 255]) }));
    expect(withResult.canExport).toBe(true);
  });
});
