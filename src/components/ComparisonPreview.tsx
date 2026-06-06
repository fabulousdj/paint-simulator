import { useEffect, useRef, useState, type PointerEvent } from "react";

export type PreviewMode = "split" | "toggle" | "side-by-side";
export type ToggleViewMode = "before" | "after";

type ComparisonPreviewProps = {
  sourceImageData: ImageData;
  resultImageData: ImageData | Uint8ClampedArray | null;
  workingWidth: number;
  workingHeight: number;
  displayWidth: number;
  displayHeight: number;
  mode: PreviewMode;
  toggleViewMode: ToggleViewMode;
};

function resultToImageData(result: ImageData | Uint8ClampedArray | null, width: number, height: number): ImageData | null {
  if (!result) return null;
  if (result instanceof ImageData) return result;
  if (result.length !== width * height * 4) return null;
  return new ImageData(new Uint8ClampedArray(result), width, height);
}

function drawImageData(
  canvas: HTMLCanvasElement | null,
  imageData: ImageData,
  sourceWidth: number,
  sourceHeight: number,
  displayWidth: number,
  displayHeight: number
) {
  if (!canvas) return;
  canvas.width = displayWidth || 1;
  canvas.height = displayHeight || 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = sourceWidth;
  sourceCanvas.height = sourceHeight;
  const sourceCtx = sourceCanvas.getContext("2d");
  if (!sourceCtx) return;
  sourceCtx.putImageData(imageData, 0, 0);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(sourceCanvas, 0, 0, displayWidth, displayHeight);
}

export function ComparisonPreview({
  sourceImageData,
  resultImageData,
  workingWidth,
  workingHeight,
  displayWidth,
  displayHeight,
  mode,
  toggleViewMode,
}: ComparisonPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const beforeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const afterCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const result = resultToImageData(resultImageData, workingWidth, workingHeight);
  const sideGap = 16;
  const sideWidth = Math.max(1, Math.floor((displayWidth - sideGap) / 2));
  const sideHeight = Math.max(1, Math.round(sideWidth * (workingHeight / Math.max(1, workingWidth))));

  useEffect(() => {
    if (mode === "side-by-side") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = displayWidth || 1;
    canvas.height = displayHeight || 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = workingWidth;
    sourceCanvas.height = workingHeight;
    const sourceCtx = sourceCanvas.getContext("2d");
    if (!sourceCtx) return;
    sourceCtx.putImageData(sourceImageData, 0, 0);

    const resultCanvas = document.createElement("canvas");
    resultCanvas.width = workingWidth;
    resultCanvas.height = workingHeight;
    const resultCtx = resultCanvas.getContext("2d");
    if (result && resultCtx) resultCtx.putImageData(result, 0, 0);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (mode === "toggle") {
      const activeCanvas = toggleViewMode === "after" && result ? resultCanvas : sourceCanvas;
      ctx.drawImage(activeCanvas, 0, 0, displayWidth, displayHeight);
      return;
    }

    ctx.drawImage(sourceCanvas, 0, 0, displayWidth, displayHeight);
    if (result) {
      const splitX = Math.floor(displayWidth * splitRatio);
      ctx.save();
      ctx.beginPath();
      ctx.rect(splitX, 0, displayWidth - splitX, displayHeight);
      ctx.clip();
      ctx.drawImage(resultCanvas, 0, 0, displayWidth, displayHeight);
      ctx.restore();
      ctx.fillStyle = "rgba(15, 118, 110, 0.95)";
      ctx.fillRect(splitX - 1, 0, 2, displayHeight);
      ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
      ctx.strokeStyle = "rgba(15, 118, 110, 0.95)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(splitX - 14, displayHeight / 2 - 24, 28, 48, 14);
      ctx.fill();
      ctx.stroke();
    }
  }, [displayHeight, displayWidth, mode, result, sourceImageData, splitRatio, toggleViewMode, workingHeight, workingWidth]);

  useEffect(() => {
    if (mode !== "side-by-side") return;
    drawImageData(beforeCanvasRef.current, sourceImageData, workingWidth, workingHeight, sideWidth, sideHeight);
    drawImageData(afterCanvasRef.current, result ?? sourceImageData, workingWidth, workingHeight, sideWidth, sideHeight);
  }, [mode, result, sideHeight, sideWidth, sourceImageData, workingHeight, workingWidth]);

  if (mode === "side-by-side") {
    return (
      <div className="flex max-w-full flex-col gap-4 xl:flex-row xl:items-center">
        <figure className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <figcaption className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Before</figcaption>
          <canvas ref={beforeCanvasRef} className="max-w-full rounded-lg" aria-label="Original room photo preview" />
        </figure>
        <figure className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <figcaption className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">After</figcaption>
          <canvas ref={afterCanvasRef} className="max-w-full rounded-lg" aria-label="Simulated paint preview" />
        </figure>
      </div>
    );
  }

  const updateSplitFromEvent = (event: PointerEvent<HTMLCanvasElement>) => {
    if (mode !== "split" || !result) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / Math.max(1, rect.width);
    setSplitRatio(Math.min(0.92, Math.max(0.08, ratio)));
  };

  return (
    <canvas
      ref={canvasRef}
      className={`max-h-full max-w-full rounded-xl shadow-sm ${mode === "split" && result ? "cursor-col-resize" : ""}`}
      aria-label={mode === "split" ? "Draggable split paint comparison preview" : "Paint comparison preview"}
      onPointerDown={(event) => {
        if (mode !== "split" || !result) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        setIsDraggingSplit(true);
        updateSplitFromEvent(event);
      }}
      onPointerMove={(event) => {
        if (isDraggingSplit) updateSplitFromEvent(event);
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        setIsDraggingSplit(false);
      }}
      onPointerCancel={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        setIsDraggingSplit(false);
      }}
    />
  );
}
