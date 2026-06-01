import type { ProjectSession } from "../types/session";
import { getMaskAlpha } from "./workflow";

export type ExportInput = {
  sourceImageData: ImageData;
  resultImageData: ProjectSession["resultImageData"];
  mask: ProjectSession["maskImageData"];
};

function resultToData(result: ProjectSession["resultImageData"], width: number, height: number): Uint8ClampedArray | null {
  if (!result) return null;
  if (result instanceof Uint8ClampedArray) return result.length === width * height * 4 ? result : null;
  if (result.width !== width || result.height !== height) return null;
  return result.data;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function composeExportImage({ sourceImageData, resultImageData, mask }: ExportInput): ImageData {
  const { width, height } = sourceImageData;
  const result = resultToData(resultImageData, width, height);
  const alpha = getMaskAlpha(mask, width, height);

  if (!result) throw new Error("Export requires simulated result pixels.");
  if (!alpha) throw new Error("Export requires a mask matching the working image.");

  const output = new Uint8ClampedArray(sourceImageData.data);
  for (let pixelIndex = 0; pixelIndex < alpha.length; pixelIndex += 1) {
    if ((alpha[pixelIndex] ?? 0) <= 0) continue;
    const sourceIndex = pixelIndex * 4;
    output[sourceIndex] = result[sourceIndex] ?? output[sourceIndex] ?? 0;
    output[sourceIndex + 1] = result[sourceIndex + 1] ?? output[sourceIndex + 1] ?? 0;
    output[sourceIndex + 2] = result[sourceIndex + 2] ?? output[sourceIndex + 2] ?? 0;
    output[sourceIndex + 3] = result[sourceIndex + 3] ?? output[sourceIndex + 3] ?? 255;
  }

  return new ImageData(output, width, height);
}

export function createExportFilename(date = new Date()): string {
  const stamp = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
  return `chromamatch-preview-${stamp}.png`;
}
