import type { PaintColor } from "../types/session";
import { computedLrvFromRgb, rgbToLabD50, rgbToHex } from "../utils/color";

export type ValidationRegion = {
  id: string;
  label: string;
  pixelIndexes: number[];
};

export type ValidationFixture = {
  id: string;
  name: string;
  lightingCondition: "bright" | "shadowed" | "mixed-lighting";
  transition: string;
  width: number;
  height: number;
  pixels: number[];
  mask: number[];
  paintA: PaintColor;
  paintB: PaintColor;
  regions: ValidationRegion[];
};

function paint(rgb: { r: number; g: number; b: number }, lrv: number, name: string): PaintColor {
  const computedLrv = computedLrvFromRgb(rgb);

  return {
    name,
    hex: rgbToHex(rgb),
    rgb,
    lrv,
    labD50: rgbToLabD50(rgb),
    computedLrv,
    lrvDelta: computedLrv - lrv,
  };
}

export const validationFixtures: ValidationFixture[] = [
  {
    id: "bright-neutral-to-cool-gray",
    name: "Bright neutral wall to cool gray",
    lightingCondition: "bright",
    transition: "light-neutral-to-cool-gray",
    width: 3,
    height: 2,
    pixels: [
      212, 216, 215, 255, 222, 225, 224, 255, 190, 194, 193, 255,
      96, 82, 70, 255, 202, 206, 205, 255, 232, 234, 232, 255,
    ],
    mask: [255, 255, 255, 0, 255, 0],
    paintA: paint({ r: 212, g: 216, b: 215 }, 68, "Current neutral"),
    paintB: paint({ r: 201, g: 204, b: 205 }, 60, "Target cool gray"),
    regions: [
      { id: "lit-wall", label: "Lit wall area", pixelIndexes: [0, 1] },
      { id: "shadow-wall", label: "Shadow falloff wall area", pixelIndexes: [2, 4] },
    ],
  },
  {
    id: "shadowed-neutral-to-warm-beige",
    name: "Shadowed neutral wall to warm beige",
    lightingCondition: "shadowed",
    transition: "light-neutral-to-warm-beige",
    width: 3,
    height: 2,
    pixels: [
      152, 154, 153, 255, 118, 121, 120, 255, 83, 86, 86, 255,
      68, 56, 48, 255, 132, 134, 133, 255, 174, 176, 175, 255,
    ],
    mask: [255, 255, 255, 0, 255, 255],
    paintA: paint({ r: 212, g: 216, b: 215 }, 68, "Current neutral"),
    paintB: paint({ r: 205, g: 191, b: 176 }, 53, "Target warm beige"),
    regions: [
      { id: "deep-shadow", label: "Deep shadow wall area", pixelIndexes: [1, 2] },
      { id: "mid-wall", label: "Mid wall area", pixelIndexes: [0, 4, 5] },
    ],
  },
];
