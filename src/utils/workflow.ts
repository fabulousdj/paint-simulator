import type { ProjectSession } from "../types/session";
import { hasMaskCoverage } from "./mask";

export type WorkflowBlockerId = "image" | "paint-a" | "paint-b" | "mask" | "result";

export type WorkflowBlocker = {
  id: WorkflowBlockerId;
  message: string;
};

export type WorkflowReadiness = {
  blockers: WorkflowBlocker[];
  exportBlockers: WorkflowBlocker[];
  canSimulate: boolean;
  canExport: boolean;
};

export function getMaskAlpha(mask: ProjectSession["maskImageData"], width: number, height: number): Uint8ClampedArray | null {
  if (!mask || width <= 0 || height <= 0) return null;
  if (mask instanceof Uint8ClampedArray) return mask.length === width * height ? mask : null;
  if (mask.width !== width || mask.height !== height) return null;

  const alpha = new Uint8ClampedArray(width * height);
  for (let i = 0; i < alpha.length; i += 1) {
    alpha[i] = mask.data[i * 4 + 3] ?? 0;
  }
  return alpha;
}

export function getWorkflowReadiness(session: ProjectSession): WorkflowReadiness {
  const blockers: WorkflowBlocker[] = [];
  const { workingWidth, workingHeight, sourceImageData } = session.image;
  const mask = getMaskAlpha(session.maskImageData, workingWidth, workingHeight);

  if (!sourceImageData || workingWidth <= 0 || workingHeight <= 0) {
    blockers.push({ id: "image", message: "Upload a room photo." });
  }
  if (!session.paintA) {
    blockers.push({ id: "paint-a", message: "Enter a valid current Paint A color and LRV." });
  }
  if (!session.paintB) {
    blockers.push({ id: "paint-b", message: "Enter a valid target Paint B color and LRV." });
  }
  if (!hasMaskCoverage(mask)) {
    blockers.push({ id: "mask", message: "Add a non-empty wall mask." });
  }

  const exportBlockers = [...blockers];
  const hasResult = Boolean(session.resultImageData);
  if (!hasResult) {
    exportBlockers.push({ id: "result", message: "Wait for the simulated result." });
  }

  return {
    blockers,
    exportBlockers,
    canSimulate: blockers.length === 0,
    canExport: exportBlockers.length === 0,
  };
}
