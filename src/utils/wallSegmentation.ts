import type { SmartMaskPoint } from "./smartMask";

type TensorLike = {
  data: ArrayLike<number>;
  dims?: number[];
};

export type WallSegmentationWorkerRequest = {
  requestId: number;
  sourceImageData: ImageData;
  point: SmartMaskPoint;
};

export type WallSegmentationWorkerResponse = {
  requestId: number;
  mask?: Uint8ClampedArray;
  error?: string;
};

let workerRef: Worker | null = null;
let nextWorkerRequestId = 1;
const pendingWorkerRequests = new Map<
  number,
  {
    resolve: (mask: Uint8ClampedArray) => void;
    reject: (error: Error) => void;
  }
>();

export function bestMaskIndex(scores: TensorLike | null | undefined, candidateCount: number): number {
  if (!scores || candidateCount <= 1) return 0;

  let bestIndex = 0;
  let bestScore = Number.NEGATIVE_INFINITY;
  const limit = Math.min(candidateCount, scores.data.length);
  for (let index = 0; index < limit; index += 1) {
    const score = Number(scores.data[index] ?? Number.NEGATIVE_INFINITY);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }
  return bestIndex;
}

export function tensorMaskToAlpha(
  maskTensor: TensorLike,
  targetWidth: number,
  targetHeight: number,
  scores?: TensorLike | null
): Uint8ClampedArray {
  const dims = maskTensor.dims ?? [];
  const sourceWidth = dims.length >= 2 ? dims[dims.length - 1] ?? targetWidth : targetWidth;
  const sourceHeight = dims.length >= 2 ? dims[dims.length - 2] ?? targetHeight : targetHeight;
  const sourcePixelCount = sourceWidth * sourceHeight;
  const candidateCount = sourcePixelCount > 0 ? Math.max(1, Math.floor(maskTensor.data.length / sourcePixelCount)) : 1;
  const candidateIndex = bestMaskIndex(scores, candidateCount);
  const offset = candidateIndex * sourcePixelCount;
  const alpha = new Uint8ClampedArray(targetWidth * targetHeight);

  if (targetWidth <= 0 || targetHeight <= 0 || sourceWidth <= 0 || sourceHeight <= 0) return alpha;

  for (let y = 0; y < targetHeight; y += 1) {
    const sourceY = Math.min(sourceHeight - 1, Math.floor((y / targetHeight) * sourceHeight));
    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = Math.min(sourceWidth - 1, Math.floor((x / targetWidth) * sourceWidth));
      alpha[y * targetWidth + x] = (maskTensor.data[offset + sourceY * sourceWidth + sourceX] ?? 0) ? 255 : 0;
    }
  }

  return alpha;
}

export function mergePromptMask(
  currentMask: Uint8ClampedArray,
  promptMask: Uint8ClampedArray
): Uint8ClampedArray {
  const next = new Uint8ClampedArray(currentMask);
  const limit = Math.min(next.length, promptMask.length);
  for (let index = 0; index < limit; index += 1) {
    if ((promptMask[index] ?? 0) > 0) next[index] = 255;
  }
  return next;
}

export function removePromptMask(
  currentMask: Uint8ClampedArray,
  promptMask: Uint8ClampedArray
): Uint8ClampedArray {
  const next = new Uint8ClampedArray(currentMask);
  const limit = Math.min(next.length, promptMask.length);
  for (let index = 0; index < limit; index += 1) {
    if ((promptMask[index] ?? 0) > 0) next[index] = 0;
  }
  return next;
}

function rejectPendingWorkerRequests(error: Error) {
  for (const request of pendingWorkerRequests.values()) request.reject(error);
  pendingWorkerRequests.clear();
}

function getWallSegmentationWorker() {
  workerRef ??= new Worker(new URL("../workers/wallSegmentationWorker.ts", import.meta.url), { type: "module" });
  workerRef.onmessage = (event: MessageEvent<WallSegmentationWorkerResponse>) => {
    const pending = pendingWorkerRequests.get(event.data.requestId);
    if (!pending) return;

    pendingWorkerRequests.delete(event.data.requestId);
    if (event.data.mask) pending.resolve(event.data.mask);
    else pending.reject(new Error(event.data.error ?? "Wall selection failed."));
  };
  workerRef.onerror = () => {
    workerRef?.terminate();
    workerRef = null;
    rejectPendingWorkerRequests(new Error("Wall selection worker failed."));
  };
  return workerRef;
}

export function selectWallMaskFromPoint({
  sourceImageData,
  point,
}: {
  sourceImageData: ImageData;
  point: SmartMaskPoint;
}): Promise<Uint8ClampedArray> {
  if (typeof Worker === "undefined") return Promise.reject(new Error("Wall selection requires Web Worker support."));

  return new Promise((resolve, reject) => {
    const requestId = nextWorkerRequestId;
    nextWorkerRequestId += 1;
    pendingWorkerRequests.set(requestId, { resolve, reject });
    getWallSegmentationWorker().postMessage({ requestId, sourceImageData, point } satisfies WallSegmentationWorkerRequest);
  });
}
