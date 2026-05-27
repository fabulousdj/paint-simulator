import type { PaintColor, RgbColor, SimulationMode } from "../types/session";
import { encodeChannel, labToXyzD50, rgbToLabD50, xyzD50ToLinear } from "./color";

const RGB_RATIO_EPSILON = 1;

export type SimulationInput = {
  sourceImageData: ImageData;
  mask: Uint8ClampedArray;
  paintA: PaintColor;
  paintB: PaintColor;
  mode?: SimulationMode;
};

export type SimulationMetadata = {
  mode: SimulationMode;
  clippedPixelCount: number;
  clippedChannelCount: number;
  affectedPixelCount: number;
};

export type SimulationResult = {
  imageData: ImageData;
  metadata: SimulationMetadata;
};

export type SimulationWorkerRequest = SimulationInput & {
  requestId: number;
};

export type SimulationWorkerResponse = SimulationResult & {
  requestId: number;
};

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function channelRatio(observed: number, from: number, to: number) {
  return (observed / Math.max(from, RGB_RATIO_EPSILON)) * to;
}

function rgbToImageDataPixel(data: Uint8ClampedArray, index: number): RgbColor {
  return {
    r: data[index] ?? 0,
    g: data[index + 1] ?? 0,
    b: data[index + 2] ?? 0,
  };
}

function labToRgbWithClipping(lab: { l: number; a: number; b: number }) {
  const l = Math.max(0, Math.min(100, lab.l));
  let clippedChannels = l === lab.l ? 0 : 1;
  const xyz = labToXyzD50({ ...lab, l });
  const linear = xyzD50ToLinear(xyz);
  const channels = [linear.r, linear.g, linear.b].map((channel) => encodeChannel(channel) * 255);
  clippedChannels += channels.filter((channel) => channel < 0 || channel > 255).length;

  return {
    rgb: {
      r: clampByte(channels[0] ?? 0),
      g: clampByte(channels[1] ?? 0),
      b: clampByte(channels[2] ?? 0),
    },
    clippedChannels,
  };
}

function simulateLabPixel(observed: RgbColor, paintA: PaintColor, paintB: PaintColor) {
  const observedLab = rgbToLabD50(observed);
  return labToRgbWithClipping({
    l: observedLab.l + (paintB.labD50.l - paintA.labD50.l),
    a: observedLab.a + (paintB.labD50.a - paintA.labD50.a),
    b: observedLab.b + (paintB.labD50.b - paintA.labD50.b),
  });
}

function simulateRgbRatioPixel(observed: RgbColor, paintA: PaintColor, paintB: PaintColor) {
  const channels = [
    channelRatio(observed.r, paintA.rgb.r, paintB.rgb.r),
    channelRatio(observed.g, paintA.rgb.g, paintB.rgb.g),
    channelRatio(observed.b, paintA.rgb.b, paintB.rgb.b),
  ];

  return {
    rgb: {
      r: clampByte(channels[0] ?? 0),
      g: clampByte(channels[1] ?? 0),
      b: clampByte(channels[2] ?? 0),
    },
    clippedChannels: channels.filter((channel) => channel < 0 || channel > 255).length,
  };
}

export function simulatePaintTransfer({
  sourceImageData,
  mask,
  paintA,
  paintB,
  mode = "lab-delta-d50",
}: SimulationInput): SimulationResult {
  const { width, height } = sourceImageData;
  const source = sourceImageData.data;
  const result = new Uint8ClampedArray(source);
  const metadata: SimulationMetadata = {
    mode,
    clippedPixelCount: 0,
    clippedChannelCount: 0,
    affectedPixelCount: 0,
  };

  if (mask.length !== width * height) {
    return { imageData: new ImageData(result, width, height), metadata };
  }

  for (let pixelIndex = 0; pixelIndex < mask.length; pixelIndex += 1) {
    const alpha = (mask[pixelIndex] ?? 0) / 255;
    if (alpha <= 0) continue;

    const sourceIndex = pixelIndex * 4;
    const observed = rgbToImageDataPixel(source, sourceIndex);
    const simulated = mode === "rgb-ratio-debug"
      ? simulateRgbRatioPixel(observed, paintA, paintB)
      : simulateLabPixel(observed, paintA, paintB);

    result[sourceIndex] = clampByte(observed.r * (1 - alpha) + simulated.rgb.r * alpha);
    result[sourceIndex + 1] = clampByte(observed.g * (1 - alpha) + simulated.rgb.g * alpha);
    result[sourceIndex + 2] = clampByte(observed.b * (1 - alpha) + simulated.rgb.b * alpha);
    result[sourceIndex + 3] = source[sourceIndex + 3] ?? 255;

    metadata.affectedPixelCount += 1;
    metadata.clippedChannelCount += simulated.clippedChannels;
    if (simulated.clippedChannels > 0) metadata.clippedPixelCount += 1;
  }

  return { imageData: new ImageData(result, width, height), metadata };
}
