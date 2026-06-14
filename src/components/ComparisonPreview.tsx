import { useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";

export type PreviewMode = "split" | "toggle" | "side-by-side";
export type ToggleViewMode = "before" | "after";

type ComparisonPreviewProps = {
  sourceImageData: ImageData;
  resultImageData: ImageData | Uint8ClampedArray | null;
  mask: ImageData | Uint8ClampedArray | null;
  workingWidth: number;
  workingHeight: number;
  displayWidth: number;
  displayHeight: number;
  viewportWidth?: number;
  viewportHeight?: number;
  mode: PreviewMode;
  toggleViewMode: ToggleViewMode;
  showMaskOverlay?: boolean;
  panContainerRef?: RefObject<HTMLDivElement | null>;
  onPanBy?: (deltaX: number, deltaY: number) => void;
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

function maskToAlpha(mask: ImageData | Uint8ClampedArray | null, width: number, height: number) {
  if (!mask) return null;
  if (mask instanceof Uint8ClampedArray) return mask.length === width * height ? mask : null;
  if (mask.width !== width || mask.height !== height) return null;

  const alpha = new Uint8ClampedArray(width * height);
  for (let i = 0; i < alpha.length; i += 1) alpha[i] = mask.data[i * 4 + 3] ?? 0;
  return alpha;
}

function createMaskOverlayCanvas(mask: ImageData | Uint8ClampedArray | null, width: number, height: number) {
  const alpha = maskToAlpha(mask, width, height);
  if (!alpha) return null;

  const overlayCanvas = document.createElement("canvas");
  overlayCanvas.width = width;
  overlayCanvas.height = height;
  const overlayCtx = overlayCanvas.getContext("2d");
  if (!overlayCtx) return null;

  const overlay = overlayCtx.createImageData(width, height);
  for (let i = 0; i < alpha.length; i += 1) {
    const pixel = i * 4;
    overlay.data[pixel] = 37;
    overlay.data[pixel + 1] = 99;
    overlay.data[pixel + 2] = 235;
    overlay.data[pixel + 3] = Math.round((alpha[i] ?? 0) * 0.35);
  }
  overlayCtx.putImageData(overlay, 0, 0);
  return overlayCanvas;
}

export function ComparisonPreview({
  sourceImageData,
  resultImageData,
  mask,
  workingWidth,
  workingHeight,
  displayWidth,
  displayHeight,
  viewportWidth,
  viewportHeight,
  mode,
  toggleViewMode,
  showMaskOverlay = false,
  panContainerRef,
  onPanBy,
}: ComparisonPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const beforeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const afterCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const panRef = useRef<{ pointerId: number; lastX: number; lastY: number; scrollLeft: number; scrollTop: number } | null>(null);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const [isHoveringSplit, setIsHoveringSplit] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const result = resultToImageData(resultImageData, workingWidth, workingHeight);
  const sideGap = 16;
  const sideCardChromeX = 52;
  const sideCardChromeY = 52;
  const sideAvailableWidth = Math.max(displayWidth, (viewportWidth ?? displayWidth) - 48);
  const sideAvailableHeight = Math.max(displayHeight, (viewportHeight ?? displayHeight) - 48);
  const sideWidthByWidth = Math.floor((sideAvailableWidth - sideGap - sideCardChromeX) / 2);
  const sideWidthByHeight = Math.floor((sideAvailableHeight - sideCardChromeY) * (workingWidth / Math.max(1, workingHeight)));
  const sideWidth = Math.max(1, Math.min(sideWidthByWidth, sideWidthByHeight));
  const sideHeight = Math.max(1, Math.round(sideWidth * (workingHeight / Math.max(1, workingWidth))));
  const panCursorClass = isPanning ? "cursor-grabbing" : "cursor-grab";

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
    const overlayCanvas = showMaskOverlay ? createMaskOverlayCanvas(mask, workingWidth, workingHeight) : null;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (mode === "toggle") {
      const activeCanvas = toggleViewMode === "after" && result ? resultCanvas : sourceCanvas;
      ctx.drawImage(activeCanvas, 0, 0, displayWidth, displayHeight);
      if (overlayCanvas) ctx.drawImage(overlayCanvas, 0, 0, displayWidth, displayHeight);
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
    if (overlayCanvas) ctx.drawImage(overlayCanvas, 0, 0, displayWidth, displayHeight);
  }, [displayHeight, displayWidth, mask, mode, result, showMaskOverlay, sourceImageData, splitRatio, toggleViewMode, workingHeight, workingWidth]);

  useEffect(() => {
    if (mode !== "side-by-side") return;
    drawImageData(beforeCanvasRef.current, sourceImageData, workingWidth, workingHeight, sideWidth, sideHeight);
    drawImageData(afterCanvasRef.current, result ?? sourceImageData, workingWidth, workingHeight, sideWidth, sideHeight);
  }, [mode, result, sideHeight, sideWidth, sourceImageData, workingHeight, workingWidth]);

  const updateSplitFromEvent = (event: PointerEvent<HTMLCanvasElement>) => {
    if (mode !== "split" || !result) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / Math.max(1, rect.width);
    setSplitRatio(Math.min(0.92, Math.max(0.08, ratio)));
  };

  const isNearSplitDivider = (event: PointerEvent<HTMLCanvasElement>) => {
    if (mode !== "split" || !result) return false;
    const rect = event.currentTarget.getBoundingClientRect();
    const splitX = rect.left + rect.width * splitRatio;
    return Math.abs(event.clientX - splitX) <= 14;
  };

  const startPan = (event: PointerEvent<HTMLElement>) => {
    const panContainer = panContainerRef?.current;
    if (!panContainer && !onPanBy) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    panRef.current = {
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
      scrollLeft: panContainer?.scrollLeft ?? 0,
      scrollTop: panContainer?.scrollTop ?? 0,
    };
    setIsPanning(true);
  };

  const updatePan = (event: PointerEvent<HTMLElement>) => {
    const pan = panRef.current;
    const panContainer = panContainerRef?.current;
    if (!pan) return false;
    if (onPanBy) {
      onPanBy(event.clientX - pan.lastX, event.clientY - pan.lastY);
      pan.lastX = event.clientX;
      pan.lastY = event.clientY;
      return true;
    }
    if (!panContainer) return false;
    panContainer.scrollLeft -= event.clientX - pan.lastX;
    panContainer.scrollTop -= event.clientY - pan.lastY;
    pan.lastX = event.clientX;
    pan.lastY = event.clientY;
    return true;
  };

  const stopPan = (event: PointerEvent<HTMLElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    panRef.current = null;
    setIsPanning(false);
  };

  if (mode === "side-by-side") {
    const panHandlers = {
      onPointerDown: startPan,
      onPointerMove: updatePan,
      onPointerUp: stopPan,
      onPointerCancel: stopPan,
    };

    return (
      <div className="flex shrink-0 flex-col gap-4 xl:flex-row xl:items-center">
        <figure className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <figcaption className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Before</figcaption>
          <canvas ref={beforeCanvasRef} className={`touch-none rounded-lg ${panCursorClass}`} style={{ width: sideWidth, height: sideHeight }} aria-label="Original room photo preview" {...panHandlers} />
        </figure>
        <figure className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <figcaption className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">After</figcaption>
          <canvas ref={afterCanvasRef} className={`touch-none rounded-lg ${panCursorClass}`} style={{ width: sideWidth, height: sideHeight }} aria-label="Simulated paint preview" {...panHandlers} />
        </figure>
      </div>
    );
  }

  const canvasCursorClass = mode === "split" && result && isHoveringSplit ? "cursor-col-resize" : panCursorClass;

  return (
    <canvas
      ref={canvasRef}
      className={`shrink-0 touch-none rounded-xl shadow-sm ${canvasCursorClass}`}
      style={{ width: displayWidth || undefined, height: displayHeight || undefined }}
      aria-label={mode === "split" ? "Draggable split paint comparison preview" : "Paint comparison preview"}
      onPointerDown={(event) => {
        if (mode !== "split" || !result || !isNearSplitDivider(event)) {
          startPan(event);
          return;
        }
        event.currentTarget.setPointerCapture(event.pointerId);
        setIsDraggingSplit(true);
        updateSplitFromEvent(event);
      }}
      onPointerMove={(event) => {
        if (isDraggingSplit) {
          updateSplitFromEvent(event);
          return;
        }
        if (updatePan(event)) return;
        setIsHoveringSplit(isNearSplitDivider(event));
      }}
      onPointerUp={(event) => {
        setIsDraggingSplit(false);
        stopPan(event);
      }}
      onPointerCancel={(event) => {
        setIsDraggingSplit(false);
        stopPan(event);
      }}
      onPointerLeave={() => {
        if (!isDraggingSplit) setIsHoveringSplit(false);
      }}
    />
  );
}
