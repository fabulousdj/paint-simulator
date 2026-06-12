const WORKING_MAX_DIM = 2048;

/** Compute dimensions to fit the image within a container while preserving aspect ratio. */
export function containDimensions(
  imgW: number,
  imgH: number,
  containerW: number,
  containerH: number
): { w: number; h: number; scale: number } {
  if (imgW <= 0 || imgH <= 0 || containerW <= 0 || containerH <= 0) {
    return { w: 0, h: 0, scale: 0 };
  }

  const scale = Math.min(containerW / imgW, containerH / imgH, 1);
  return {
    w: Math.round(imgW * scale),
    h: Math.round(imgH * scale),
    scale,
  };
}

/** Compute working image dimensions bounded by max dimension. */
export function workingDimensions(origW: number, origH: number, maxDim: number = WORKING_MAX_DIM): { w: number; h: number } {
  if (origW <= 0 || origH <= 0 || maxDim <= 0) return { w: 0, h: 0 };
  if (origW <= maxDim && origH <= maxDim) return { w: origW, h: origH };
  const scale = maxDim / Math.max(origW, origH);
  return {
    w: Math.round(origW * scale),
    h: Math.round(origH * scale),
  };
}

/** Display coords → working image coords. Assumes image is "contain"-scaled in container. */
export function displayToWorking(
  dx: number,
  dy: number,
  displayW: number,
  displayH: number,
  workW: number,
  workH: number
): { x: number; y: number } {
  if (displayW <= 0 || displayH <= 0 || workW <= 0 || workH <= 0) {
    return { x: 0, y: 0 };
  }

  const xScale = workW / displayW;
  const yScale = workH / displayH;
  return {
    x: Math.round(dx * xScale),
    y: Math.round(dy * yScale),
  };
}

/** Working image coords → display coords. */
export function workingToDisplay(
  wx: number,
  wy: number,
  displayW: number,
  displayH: number,
  workW: number,
  workH: number
): { x: number; y: number } {
  if (displayW <= 0 || displayH <= 0 || workW <= 0 || workH <= 0) {
    return { x: 0, y: 0 };
  }

  const xScale = displayW / workW;
  const yScale = displayH / workH;
  return {
    x: Math.round(wx * xScale),
    y: Math.round(wy * yScale),
  };
}

export const WORKING_MAX = WORKING_MAX_DIM;
