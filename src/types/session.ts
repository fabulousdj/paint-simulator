// Color primitives from TDD data model

export type RgbColor = {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
};

export type LabColor = {
  l: number; // 0-100
  a: number;
  b: number;
};

export type PaintColor = {
  id?: string;
  brand?: string;
  collection?: string;
  name?: string;
  rgb: RgbColor;
  hex: string;
  lrv: number; // 0-100, required for MVP manual input
  labD50: LabColor;
  computedLrv: number; // Y * 100 from the D50 pipeline
  lrvDelta: number; // computedLrv - lrv
};

// Session types from TDD

export type SimulationMode = "lab-delta-d50" | "rgb-ratio-debug";

export type BrushState = {
  sizePx: number;
  opacity: number;
  mode: "paint" | "erase";
};

export type ImagePipeline = {
  sourceImage: HTMLImageElement | null;
  sourceImageData: ImageData | null;
  workingWidth: number;
  workingHeight: number;
  displayWidth: number;
  displayHeight: number;
};

export type ProjectSession = {
  image: ImagePipeline;
  maskImageData: ImageData | Uint8ClampedArray | null;
  resultImageData: ImageData | Uint8ClampedArray | null;
  paintA: PaintColor | null;
  paintB: PaintColor | null;
  simulationMode: SimulationMode;
  brush: BrushState;
};

export const defaultSession: ProjectSession = {
  image: {
    sourceImage: null,
    sourceImageData: null,
    workingWidth: 0,
    workingHeight: 0,
    displayWidth: 0,
    displayHeight: 0,
  },
  maskImageData: null,
  resultImageData: null,
  paintA: null,
  paintB: null,
  simulationMode: "lab-delta-d50",
  brush: {
    sizePx: 32,
    opacity: 1,
    mode: "paint",
  },
};
