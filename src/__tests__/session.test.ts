import { describe, it, expect } from "vitest";
import { defaultSession } from "../types/session";
import { sessionReducer, hasImage, hasMask, hasMaskPixels, canSimulate } from "../state/session";
import { createMaskBuffer } from "../utils/mask";

describe("default session", () => {
  it("has null values and lab-delta-d50 mode", () => {
    expect(defaultSession.image.sourceImageData).toBeNull();
    expect(defaultSession.maskImageData).toBeNull();
    expect(defaultSession.resultImageData).toBeNull();
    expect(defaultSession.paintA).toBeNull();
    expect(defaultSession.paintB).toBeNull();
    expect(defaultSession.simulationMode).toBe("lab-delta-d50");
  });

  it("has sensible brush defaults", () => {
    expect(defaultSession.brush.sizePx).toBe(32);
    expect(defaultSession.brush.opacity).toBe(1);
    expect(defaultSession.brush.mode).toBe("paint");
  });
});

describe("session reducer", () => {
  it("RESET restores defaults", () => {
    const state = {
      ...defaultSession,
      paintA: {
        rgb: { r: 100, g: 100, b: 100 },
        hex: "#646464",
        lrv: 50,
        labD50: { l: 50, a: 0, b: 0 },
        computedLrv: 50,
        lrvDelta: 0,
      },
    };
    const next = sessionReducer(state, { type: "RESET_SESSION" });
    expect(next.paintA).toBeNull();
  });

  it("SET_PAINT_A sets paintA", () => {
    const paint = {
      rgb: { r: 212, g: 216, b: 215 },
      hex: "#D4D8D7",
      lrv: 68,
      labD50: { l: 86, a: -1.54, b: -0.01 },
      computedLrv: 68.1,
      lrvDelta: 0.1,
    };
    const next = sessionReducer(defaultSession, { type: "SET_PAINT_A", paint });
    expect(next.paintA).toBe(paint);
  });

  it("SET_SIMULATION_MODE changes mode", () => {
    const next = sessionReducer(defaultSession, {
      type: "SET_SIMULATION_MODE",
      mode: "rgb-ratio-debug",
    });
    expect(next.simulationMode).toBe("rgb-ratio-debug");
  });

  it("CLEAR_RESULT_BUFFER clears result image data", () => {
    const state = {
      ...defaultSession,
      resultImageData: new Uint8ClampedArray([1, 2, 3, 4]),
    };
    const next = sessionReducer(state, { type: "CLEAR_RESULT_BUFFER" });
    expect(next.resultImageData).toBeNull();
  });

  it("SET_BRUSH updates nested brush state", () => {
    let next = sessionReducer(defaultSession, { type: "SET_BRUSH_SIZE", size: 64 });
    expect(next.brush.sizePx).toBe(64);
    next = sessionReducer(next, { type: "SET_BRUSH_MODE", mode: "erase" });
    expect(next.brush.mode).toBe("erase");
    expect(next.brush.sizePx).toBe(64);
  });
});

describe("selectors", () => {
  it("hasImage is false by default", () => {
    expect(hasImage(defaultSession)).toBe(false);
  });

  it("hasMask is false by default", () => {
    expect(hasMask(defaultSession)).toBe(false);
  });

  it("hasMaskPixels detects non-zero pixels", () => {
    const state = {
      ...defaultSession,
      maskImageData: createMaskBuffer(10, 10),
    };
    expect(hasMaskPixels(state)).toBe(false);

    (state.maskImageData as Uint8ClampedArray)[5] = 255;
    expect(hasMaskPixels(state)).toBe(true);
  });

  it("canSimulate requires image + paints + mask pixels", () => {
    expect(canSimulate(defaultSession)).toBe(false);
  });
});
