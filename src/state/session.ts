import {
  ProjectSession,
  defaultSession,
  type PaintColor,
  type SimulationMode,
} from "../types/session";

// Actions map to TDD state transitions
export type SessionAction =
  | { type: "SET_IMAGE"; source: HTMLImageElement; imageData: ImageData; workingW: number; workingH: number }
  | { type: "CLEAR_IMAGE" }
  | { type: "SET_MASK_BUFFER"; buffer: Uint8ClampedArray }
  | { type: "SET_RESULT_BUFFER"; buffer: Uint8ClampedArray }
  | { type: "CLEAR_RESULT_BUFFER" }
  | { type: "SET_PAINT_A"; paint: PaintColor }
  | { type: "SET_PAINT_B"; paint: PaintColor }
  | { type: "CLEAR_PAINT_A" }
  | { type: "CLEAR_PAINT_B" }
  | { type: "SET_DISPLAY_SIZE"; displayW: number; displayH: number }
  | { type: "SET_SIMULATION_MODE"; mode: SimulationMode }
  | { type: "SET_BRUSH_SIZE"; size: number }
  | { type: "SET_BRUSH_OPACITY"; opacity: number }
  | { type: "SET_BRUSH_MODE"; mode: "paint" | "erase" }
  | { type: "RESET_SESSION" };

export function sessionReducer(
  state: ProjectSession,
  action: SessionAction
): ProjectSession {
  switch (action.type) {
    case "SET_IMAGE":
      return {
        ...state,
        image: {
          ...state.image,
          sourceImage: action.source,
          sourceImageData: action.imageData,
          workingWidth: action.workingW,
          workingHeight: action.workingH,
        },
      };

    case "CLEAR_IMAGE":
      return {
        ...state,
        image: defaultSession.image,
        maskImageData: null,
        resultImageData: null,
      };

    case "SET_MASK_BUFFER":
      return { ...state, maskImageData: action.buffer };

    case "SET_RESULT_BUFFER":
      return { ...state, resultImageData: action.buffer };

    case "CLEAR_RESULT_BUFFER":
      return { ...state, resultImageData: null };

    case "SET_PAINT_A":
      return { ...state, paintA: action.paint };

    case "SET_PAINT_B":
      return { ...state, paintB: action.paint };

    case "CLEAR_PAINT_A":
      return { ...state, paintA: null };

    case "CLEAR_PAINT_B":
      return { ...state, paintB: null };

    case "SET_DISPLAY_SIZE":
      return {
        ...state,
        image: {
          ...state.image,
          displayWidth: action.displayW,
          displayHeight: action.displayH,
        },
      };

    case "SET_SIMULATION_MODE":
      return { ...state, simulationMode: action.mode };

    case "SET_BRUSH_SIZE":
      return {
        ...state,
        brush: { ...state.brush, sizePx: action.size },
      };

    case "SET_BRUSH_OPACITY":
      return {
        ...state,
        brush: { ...state.brush, opacity: action.opacity },
      };

    case "SET_BRUSH_MODE":
      return {
        ...state,
        brush: { ...state.brush, mode: action.mode },
      };

    case "RESET_SESSION":
      return {
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
        brush: { sizePx: 32, opacity: 1, mode: "paint" },
      };

    default:
      return state;
  }
}

// Selectors
export const hasImage = (s: ProjectSession) =>
  s.image.sourceImageData !== null && s.image.workingWidth > 0;

export const hasMask = (s: ProjectSession) =>
  s.maskImageData !== null;

export const hasMaskPixels = (s: ProjectSession) => {
  if (!s.maskImageData) return false;
  const buf = s.maskImageData instanceof Uint8ClampedArray
    ? s.maskImageData
    : s.maskImageData.data;
  for (let i = 0; i < buf.length; i++) {
    const val = buf[i];
    if (val !== undefined && val > 0) return true;
  }
  return false;
};

export const canSimulate = (s: ProjectSession) =>
  hasImage(s) && s.paintA !== null && s.paintB !== null && hasMaskPixels(s);
