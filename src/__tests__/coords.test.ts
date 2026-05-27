import { describe, expect, it } from "vitest";
import {
  containDimensions,
  displayToWorking,
  workingDimensions,
  workingToDisplay,
} from "../utils/coords";

describe("workingDimensions", () => {
  it("caps the longest side at 2048 by default", () => {
    expect(workingDimensions(4096, 2048)).toEqual({ w: 2048, h: 1024 });
    expect(workingDimensions(1200, 3000)).toEqual({ w: 819, h: 2048 });
  });

  it("does not upscale small images", () => {
    expect(workingDimensions(800, 600)).toEqual({ w: 800, h: 600 });
  });

  it("returns zero dimensions for invalid input", () => {
    expect(workingDimensions(0, 600)).toEqual({ w: 0, h: 0 });
    expect(workingDimensions(800, 600, 0)).toEqual({ w: 0, h: 0 });
  });
});

describe("containDimensions", () => {
  it("fits an image inside a container without upscaling", () => {
    expect(containDimensions(1600, 900, 800, 800)).toEqual({
      w: 800,
      h: 450,
      scale: 0.5,
    });
  });

  it("keeps small images at their native display size", () => {
    expect(containDimensions(400, 300, 800, 800)).toEqual({
      w: 400,
      h: 300,
      scale: 1,
    });
  });

  it("defines zero-container behavior", () => {
    expect(containDimensions(400, 300, 0, 800)).toEqual({ w: 0, h: 0, scale: 0 });
  });
});

describe("coordinate transforms", () => {
  it("round-trips common integer scale cases", () => {
    const working = displayToWorking(100, 50, 400, 200, 800, 400);
    expect(working).toEqual({ x: 200, y: 100 });
    expect(workingToDisplay(working.x, working.y, 400, 200, 800, 400)).toEqual({
      x: 100,
      y: 50,
    });
  });

  it("supports non-uniform display/work dimensions", () => {
    expect(displayToWorking(75, 25, 300, 100, 600, 400)).toEqual({ x: 150, y: 100 });
    expect(workingToDisplay(150, 100, 300, 100, 600, 400)).toEqual({ x: 75, y: 25 });
  });

  it("returns origin for invalid display dimensions", () => {
    expect(displayToWorking(10, 10, 0, 100, 500, 500)).toEqual({ x: 0, y: 0 });
    expect(workingToDisplay(10, 10, 100, 0, 500, 500)).toEqual({ x: 0, y: 0 });
  });
});
