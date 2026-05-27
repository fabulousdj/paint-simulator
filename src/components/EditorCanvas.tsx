import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { BrushState } from "../types/session";
import { displayToWorking } from "../utils/coords";

type WorkingPoint = {
  x: number;
  y: number;
};

type EditorCanvasProps = {
  sourceImageData: ImageData;
  resultImageData: ImageData | Uint8ClampedArray | null;
  mask: ImageData | Uint8ClampedArray | null;
  workingWidth: number;
  workingHeight: number;
  displayWidth: number;
  displayHeight: number;
  brush: BrushState;
  showMaskOverlay: boolean;
  onBrushStroke: (point: WorkingPoint) => void;
};

function resultToImageData(
  result: ImageData | Uint8ClampedArray | null,
  width: number,
  height: number
): ImageData | null {
  if (!result) return null;
  if (result instanceof ImageData) return result;
  if (result.length !== width * height * 4) return null;
  return new ImageData(new Uint8ClampedArray(result), width, height);
}

function maskToAlpha(mask: ImageData | Uint8ClampedArray | null, width: number, height: number) {
  if (!mask) return null;
  if (mask instanceof ImageData) {
    if (mask.width !== width || mask.height !== height) return null;
    const alpha = new Uint8ClampedArray(width * height);
    for (let i = 0; i < alpha.length; i += 1) {
      alpha[i] = mask.data[i * 4 + 3] ?? 0;
    }
    return alpha;
  }
  if (mask.length !== width * height) return null;
  return mask;
}

export function EditorCanvas({
  sourceImageData,
  resultImageData,
  mask,
  workingWidth,
  workingHeight,
  displayWidth,
  displayHeight,
  brush,
  showMaskOverlay,
  onBrushStroke,
}: EditorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cursor, setCursor] = useState<WorkingPoint | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = displayWidth || 1;
    canvas.height = displayHeight || 1;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (displayWidth <= 0 || displayHeight <= 0 || workingWidth <= 0 || workingHeight <= 0) return;

    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = workingWidth;
    sourceCanvas.height = workingHeight;
    const sourceCtx = sourceCanvas.getContext("2d");
    if (!sourceCtx) return;
    sourceCtx.putImageData(sourceImageData, 0, 0);
    ctx.drawImage(sourceCanvas, 0, 0, displayWidth, displayHeight);

    const result = resultToImageData(resultImageData, workingWidth, workingHeight);
    if (result) {
      const resultCanvas = document.createElement("canvas");
      resultCanvas.width = workingWidth;
      resultCanvas.height = workingHeight;
      const resultCtx = resultCanvas.getContext("2d");
      if (resultCtx) {
        resultCtx.putImageData(result, 0, 0);
        ctx.drawImage(resultCanvas, 0, 0, displayWidth, displayHeight);
      }
    }

    const alpha = maskToAlpha(mask, workingWidth, workingHeight);
    if (showMaskOverlay && alpha) {
      const overlayCanvas = document.createElement("canvas");
      overlayCanvas.width = workingWidth;
      overlayCanvas.height = workingHeight;
      const overlayCtx = overlayCanvas.getContext("2d");
      if (overlayCtx) {
        const overlay = overlayCtx.createImageData(workingWidth, workingHeight);
        for (let i = 0; i < alpha.length; i += 1) {
          const pixel = i * 4;
          overlay.data[pixel] = 37;
          overlay.data[pixel + 1] = 99;
          overlay.data[pixel + 2] = 235;
          overlay.data[pixel + 3] = Math.round((alpha[i] ?? 0) * 0.35);
        }
        overlayCtx.putImageData(overlay, 0, 0);
        ctx.drawImage(overlayCanvas, 0, 0, displayWidth, displayHeight);
      }
    }

    if (cursor) {
      const displayCursor = {
        x: (cursor.x / workingWidth) * displayWidth,
        y: (cursor.y / workingHeight) * displayHeight,
      };
      const radius = Math.max(2, (brush.sizePx / workingWidth) * displayWidth * 0.5);
      ctx.beginPath();
      ctx.arc(displayCursor.x, displayCursor.y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = brush.mode === "erase" ? "rgba(220, 38, 38, 0.95)" : "rgba(37, 99, 235, 0.95)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = brush.mode === "erase" ? "rgba(220, 38, 38, 0.08)" : "rgba(37, 99, 235, 0.08)";
      ctx.fill();
    }
  }, [brush.mode, brush.sizePx, cursor, displayHeight, displayWidth, mask, resultImageData, showMaskOverlay, sourceImageData, workingHeight, workingWidth]);

  const pointFromEvent = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return displayToWorking(
      event.clientX - rect.left,
      event.clientY - rect.top,
      rect.width,
      rect.height,
      workingWidth,
      workingHeight
    );
  };

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);
    setCursor(point);
    setIsDrawing(true);
    onBrushStroke(point);
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const point = pointFromEvent(event);
    setCursor(point);
    if (isDrawing) onBrushStroke(point);
  };

  const handlePointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.releasePointerCapture(event.pointerId);
    setIsDrawing(false);
  };

  return (
    <canvas
      ref={canvasRef}
      aria-label="Uploaded room photo canvas"
      className="max-h-full max-w-full touch-none rounded-lg border border-gray-200 bg-white shadow-sm"
      style={{ width: displayWidth || undefined, height: displayHeight || undefined }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={() => {
        setCursor(null);
        setIsDrawing(false);
      }}
    />
  );
}
