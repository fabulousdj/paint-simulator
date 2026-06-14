import { useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";
import type { BrushState } from "../types/session";
import { displayToWorking } from "../utils/coords";
import {
  applyMaskBrushInPlace,
  applyMaskStrokeInPlace,
  createMaskBuffer,
  type DirtyBounds,
} from "../utils/mask";

type WorkingPoint = {
  x: number;
  y: number;
};

export type MaskTool = "hand" | "brush" | "eraser" | "sam-add" | "sam-remove" | "edge-add" | "edge-remove" | "polygon-add" | "polygon-remove";
export type CanvasViewMode = "before" | "after";

type EditorCanvasProps = {
  sourceImageData: ImageData;
  resultImageData: ImageData | Uint8ClampedArray | null;
  mask: ImageData | Uint8ClampedArray | null;
  workingWidth: number;
  workingHeight: number;
  displayWidth: number;
  displayHeight: number;
  brush: BrushState;
  activeTool: MaskTool;
  viewMode: CanvasViewMode;
  showMaskOverlay: boolean;
  polygonPoints: WorkingPoint[];
  panContainerRef: RefObject<HTMLElement | null>;
  onPanBy?: (deltaX: number, deltaY: number) => void;
  onMaskCommit: (mask: Uint8ClampedArray) => void;
  onPromptSelect: (point: WorkingPoint, mode: "add" | "remove") => void;
  onAreaFill: (point: WorkingPoint, mode: "add" | "remove") => void;
  onPolygonPoint: (point: WorkingPoint) => void;
  onPolygonClose: () => void;
};

type DisplayCursor = WorkingPoint & {
  radius: number;
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
  activeTool,
  viewMode,
  showMaskOverlay,
  polygonPoints,
  panContainerRef,
  onPanBy,
  onMaskCommit,
  onPromptSelect,
  onAreaFill,
  onPolygonPoint,
  onPolygonClose,
}: EditorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const resultCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskRef = useRef<Uint8ClampedArray | null>(null);
  const draftMaskRef = useRef<Uint8ClampedArray | null>(null);
  const lastPointRef = useRef<WorkingPoint | null>(null);
  const isDrawingRef = useRef(false);
  const panRef = useRef<{ pointerId: number; lastX: number; lastY: number; scrollLeft: number; scrollTop: number } | null>(null);
  const [cursor, setCursor] = useState<DisplayCursor | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [isHoveringFirstVertex, setIsHoveringFirstVertex] = useState(false);
  const isPolygonTool = activeTool === "polygon-add" || activeTool === "polygon-remove";
  const canClosePolygon = isPolygonTool && polygonPoints.length >= 3;

  const toDisplayPoint = (point: WorkingPoint) => ({
    x: (point.x / workingWidth) * displayWidth,
    y: (point.y / workingHeight) * displayHeight,
  });

  const isNearFirstVertex = (point: WorkingPoint) => {
    if (!canClosePolygon || workingWidth <= 0 || workingHeight <= 0) return false;
    const first = polygonPoints[0];
    if (!first) return false;
    const current = toDisplayPoint(point);
    const start = toDisplayPoint(first);
    return Math.hypot(current.x - start.x, current.y - start.y) <= 14;
  };

  const displayBounds = (bounds: DirtyBounds) => {
    const x = Math.floor((bounds.minX / workingWidth) * displayWidth);
    const y = Math.floor((bounds.minY / workingHeight) * displayHeight);
    const right = Math.ceil(((bounds.maxX + 1) / workingWidth) * displayWidth);
    const bottom = Math.ceil(((bounds.maxY + 1) / workingHeight) * displayHeight);

    return {
      sx: bounds.minX,
      sy: bounds.minY,
      sw: bounds.maxX - bounds.minX + 1,
      sh: bounds.maxY - bounds.minY + 1,
      dx: x,
      dy: y,
      dw: Math.max(1, right - x),
      dh: Math.max(1, bottom - y),
    };
  };

  const updateOverlay = (alpha: Uint8ClampedArray | null, bounds: DirtyBounds | null) => {
    let overlayCanvas = overlayCanvasRef.current;
    if (!overlayCanvas) {
      overlayCanvas = document.createElement("canvas");
      overlayCanvasRef.current = overlayCanvas;
    }
    const nextWidth = workingWidth || 1;
    const nextHeight = workingHeight || 1;
    if (overlayCanvas.width !== nextWidth || overlayCanvas.height !== nextHeight) {
      overlayCanvas.width = nextWidth;
      overlayCanvas.height = nextHeight;
    }

    const overlayCtx = overlayCanvas.getContext("2d");
    if (!overlayCtx) return;

    if (!alpha) {
      if (bounds) {
        overlayCtx.clearRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX + 1, bounds.maxY - bounds.minY + 1);
      } else {
        overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      }
      return;
    }

    const target = bounds ?? { minX: 0, minY: 0, maxX: workingWidth - 1, maxY: workingHeight - 1 };
    const width = target.maxX - target.minX + 1;
    const height = target.maxY - target.minY + 1;
    const overlay = overlayCtx.createImageData(width, height);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const sourceIndex = (target.minY + y) * workingWidth + target.minX + x;
        const pixel = (y * width + x) * 4;
        overlay.data[pixel] = 37;
        overlay.data[pixel + 1] = 99;
        overlay.data[pixel + 2] = 235;
        overlay.data[pixel + 3] = Math.round((alpha[sourceIndex] ?? 0) * 0.35);
      }
    }

    overlayCtx.putImageData(overlay, target.minX, target.minY);
  };

  const redraw = (bounds: DirtyBounds | null = null) => {
    const canvas = canvasRef.current;
    const sourceCanvas = sourceCanvasRef.current;
    if (!canvas || !sourceCanvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (!bounds) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(sourceCanvas, 0, 0, displayWidth, displayHeight);
      if (viewMode === "after" && resultCanvasRef.current) ctx.drawImage(resultCanvasRef.current, 0, 0, displayWidth, displayHeight);
      if (showMaskOverlay && overlayCanvasRef.current) {
        ctx.drawImage(overlayCanvasRef.current, 0, 0, displayWidth, displayHeight);
      }
      return;
    }

    const rect = displayBounds(bounds);
    ctx.clearRect(rect.dx, rect.dy, rect.dw, rect.dh);
    ctx.drawImage(sourceCanvas, rect.sx, rect.sy, rect.sw, rect.sh, rect.dx, rect.dy, rect.dw, rect.dh);
    if (viewMode === "after" && resultCanvasRef.current) {
      ctx.drawImage(resultCanvasRef.current, rect.sx, rect.sy, rect.sw, rect.sh, rect.dx, rect.dy, rect.dw, rect.dh);
    }
    if (showMaskOverlay && overlayCanvasRef.current) {
      ctx.drawImage(overlayCanvasRef.current, rect.sx, rect.sy, rect.sw, rect.sh, rect.dx, rect.dy, rect.dw, rect.dh);
    }
  };

  const setCursorFromPoint = (point: WorkingPoint) => {
    if (workingWidth <= 0 || workingHeight <= 0) return;
    setCursor({
      x: (point.x / workingWidth) * displayWidth,
      y: (point.y / workingHeight) * displayHeight,
      radius: Math.max(2, (brush.sizePx / workingWidth) * displayWidth * 0.5),
    });
  };

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
    sourceCanvasRef.current = sourceCanvas;

    const result = resultToImageData(resultImageData, workingWidth, workingHeight);
    if (result) {
      const resultCanvas = document.createElement("canvas");
      resultCanvas.width = workingWidth;
      resultCanvas.height = workingHeight;
      const resultCtx = resultCanvas.getContext("2d");
      if (resultCtx) {
        resultCtx.putImageData(result, 0, 0);
        resultCanvasRef.current = resultCanvas;
      }
    } else {
      resultCanvasRef.current = null;
    }

    const alpha = maskToAlpha(mask, workingWidth, workingHeight);
    maskRef.current = alpha;
    updateOverlay(alpha, null);
    redraw();
  }, [displayHeight, displayWidth, mask, resultImageData, showMaskOverlay, sourceImageData, viewMode, workingHeight, workingWidth]);

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
    if (activeTool === "hand") {
      const panContainer = panContainerRef.current;
      if (!panContainer && !onPanBy) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      panRef.current = {
        pointerId: event.pointerId,
        lastX: event.clientX,
        lastY: event.clientY,
        scrollLeft: panContainer?.scrollLeft ?? 0,
        scrollTop: panContainer?.scrollTop ?? 0,
      };
      setCursor(null);
      setIsPanning(true);
      return;
    }

    const point = pointFromEvent(event);
    setCursorFromPoint(point);

    if (activeTool === "sam-add" || activeTool === "sam-remove") {
      onPromptSelect(point, activeTool === "sam-add" ? "add" : "remove");
      return;
    }

    if (activeTool === "edge-add" || activeTool === "edge-remove") {
      onAreaFill(point, activeTool === "edge-add" ? "add" : "remove");
      return;
    }

    if (activeTool === "polygon-add" || activeTool === "polygon-remove") {
      if (isNearFirstVertex(point)) {
        onPolygonClose();
        return;
      }
      onPolygonPoint(point);
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    const currentMask = maskRef.current && maskRef.current.length === workingWidth * workingHeight
      ? new Uint8ClampedArray(maskRef.current)
      : createMaskBuffer(workingWidth, workingHeight);
    draftMaskRef.current = currentMask;
    maskRef.current = currentMask;
    lastPointRef.current = point;
    isDrawingRef.current = true;
    setCursorFromPoint(point);

    const dirty = applyMaskBrushInPlace(currentMask, workingWidth, workingHeight, {
      ...brush,
      mode: activeTool === "eraser" ? "erase" : "paint",
      ...point,
    });
    if (dirty) {
      updateOverlay(currentMask, dirty);
      redraw(dirty);
    }
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (activeTool === "hand") {
      const pan = panRef.current;
      const panContainer = panContainerRef.current;
      if (pan) {
        if (onPanBy) {
          onPanBy(event.clientX - pan.lastX, event.clientY - pan.lastY);
        } else if (panContainer) {
          panContainer.scrollLeft -= event.clientX - pan.lastX;
          panContainer.scrollTop -= event.clientY - pan.lastY;
        }
        pan.lastX = event.clientX;
        pan.lastY = event.clientY;
      }
      return;
    }

    const point = pointFromEvent(event);
    setCursorFromPoint(point);
    setIsHoveringFirstVertex(isNearFirstVertex(point));
    if (!isDrawingRef.current || !draftMaskRef.current || !lastPointRef.current) return;

    const dirty = applyMaskStrokeInPlace(
      draftMaskRef.current,
      workingWidth,
      workingHeight,
      lastPointRef.current,
      point,
      { ...brush, mode: activeTool === "eraser" ? "erase" : "paint" }
    );
    lastPointRef.current = point;
    if (dirty) {
      updateOverlay(draftMaskRef.current, dirty);
      redraw(dirty);
    }
  };

  const handlePointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    isDrawingRef.current = false;
    lastPointRef.current = null;
    panRef.current = null;
    setIsPanning(false);
    if (draftMaskRef.current) {
      onMaskCommit(new Uint8ClampedArray(draftMaskRef.current));
      draftMaskRef.current = null;
    }
  };

  const firstVertex = polygonPoints[0] ? toDisplayPoint(polygonPoints[0]) : null;
  const showBrushCursor = cursor && (activeTool === "brush" || activeTool === "eraser" || activeTool === "edge-add" || activeTool === "edge-remove");
  const showPromptCursor = cursor && (activeTool === "sam-add" || activeTool === "sam-remove");
  const isRemoveCursor = activeTool === "eraser" || activeTool === "edge-remove";
  const canvasCursor = isPanning
    ? "grabbing"
    : activeTool === "hand"
      ? "grab"
      : isHoveringFirstVertex
        ? "copy"
        : isPolygonTool
          ? "crosshair"
          : undefined;

  return (
    <div className="relative shrink-0 overflow-hidden rounded-xl shadow-sm ring-1 ring-slate-200" style={{ width: displayWidth || undefined, height: displayHeight || undefined }}>
      <canvas
        ref={canvasRef}
        aria-label="Uploaded room photo canvas"
        className="h-full w-full touch-none bg-white"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ cursor: canvasCursor }}
        onPointerLeave={() => {
          if (!isDrawingRef.current) setCursor(null);
          setIsHoveringFirstVertex(false);
        }}
      />
      {showBrushCursor ? (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute rounded-full border-2 ${isRemoveCursor ? "border-red-600 bg-red-600/10" : "border-blue-600 bg-blue-600/10"}`}
          style={{
            left: cursor.x - cursor.radius,
            top: cursor.y - cursor.radius,
            width: cursor.radius * 2,
            height: cursor.radius * 2,
          }}
        />
      ) : null}
      {showPromptCursor ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute flex h-4 w-4 items-center justify-center rounded-full border border-slate-700 bg-white text-[10px] font-bold leading-none text-slate-700 shadow-sm"
          style={{
            left: cursor.x + 8,
            top: cursor.y + 8,
          }}
        >
          {activeTool === "sam-remove" ? "-" : "+"}
        </div>
      ) : null}
      {polygonPoints.length > 0 ? (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          viewBox={`0 0 ${displayWidth || 1} ${displayHeight || 1}`}
        >
          <polyline
            fill="none"
            points={polygonPoints
              .map((point) => `${(point.x / workingWidth) * displayWidth},${(point.y / workingHeight) * displayHeight}`)
              .join(" ")}
            stroke={activeTool === "polygon-remove" ? "#dc2626" : "#2563eb"}
            strokeDasharray="6 4"
            strokeWidth="2"
          />
          {polygonPoints.map((point, index) => {
            const displayPoint = toDisplayPoint(point);
            const isFirstVertex = index === 0 && canClosePolygon;
            const color = activeTool === "polygon-remove" ? "#dc2626" : "#2563eb";
            return (
              <g key={`${point.x}-${point.y}-${index}`}>
                {isFirstVertex ? (
                  <circle
                    className="animate-ping"
                    cx={displayPoint.x}
                    cy={displayPoint.y}
                    r="9"
                    fill="none"
                    stroke={color}
                    strokeWidth="3"
                    opacity="0.65"
                  />
                ) : null}
                <circle
                  cx={displayPoint.x}
                  cy={displayPoint.y}
                  r={isFirstVertex ? "6" : "4"}
                  fill={color}
                  stroke="white"
                  strokeWidth="2"
                />
              </g>
            );
          })}
        </svg>
      ) : null}
      {canClosePolygon && firstVertex ? (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs font-semibold text-slate-700 shadow-lg"
          style={{ left: Math.min(firstVertex.x + 12, Math.max(12, displayWidth - 190)), top: Math.max(12, firstVertex.y - 42) }}
        >
          Click the glowing first point to finish.
        </div>
      ) : null}
    </div>
  );
}
