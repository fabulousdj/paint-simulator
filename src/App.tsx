import { PaintBucket } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { EditorCanvas, type CanvasViewMode, type MaskTool } from "./components/EditorCanvas";
import { FixturePanel } from "./components/FixturePanel";
import { ImageUpload } from "./components/ImageUpload";
import { PaintInput } from "./components/PaintInput";
import { useEditorSession } from "./hooks/useEditorSession";
import { useSimulationWorker } from "./hooks/useSimulationWorker";
import type { PaintColor } from "./types/session";
import { composeExportImage, createExportFilename } from "./utils/export";
import { emptyMaskHistory, pushMaskHistory, redoMaskHistory, undoMaskHistory, type MaskHistory } from "./utils/maskHistory";
import { resetMaskBuffer } from "./utils/mask";
import { applyPolygonToMask, edgeAwareAreaFill, type MaskApplyMode, type SmartMaskPoint } from "./utils/smartMask";
import { getWorkflowReadiness } from "./utils/workflow";

function App() {
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const [showMaskOverlay, setShowMaskOverlay] = useState(true);
  const [activeTool, setActiveTool] = useState<MaskTool>("brush");
  const [fillTolerance, setFillTolerance] = useState(34);
  const [polygonPoints, setPolygonPoints] = useState<SmartMaskPoint[]>([]);
  const [maskHistory, setMaskHistory] = useState<MaskHistory>(emptyMaskHistory);
  const [viewMode, setViewMode] = useState<CanvasViewMode>("before");
  const [exportError, setExportError] = useState<string | null>(null);
  const { state, dispatch, loadImageFile, upload } = useEditorSession(workspaceRef);
  const simulation = useSimulationWorker(state.session, dispatch);
  const hasImage = state.session.image.sourceImageData !== null;
  const readiness = getWorkflowReadiness(state.session);
  const canDownload = readiness.canExport && simulation.status === "complete";

  useEffect(() => {
    if (!state.session.resultImageData && viewMode === "after") setViewMode("before");
  }, [state.session.resultImageData, viewMode]);

  const setPaintA = useCallback(
    (paint: PaintColor | null) => {
      dispatch(paint ? { type: "SET_PAINT_A", paint } : { type: "CLEAR_PAINT_A" });
    },
    [dispatch]
  );

  const setPaintB = useCallback(
    (paint: PaintColor | null) => {
      dispatch(paint ? { type: "SET_PAINT_B", paint } : { type: "CLEAR_PAINT_B" });
    },
    [dispatch]
  );

  const clearImage = useCallback(() => {
    setPolygonPoints([]);
    setMaskHistory(emptyMaskHistory());
    dispatch({ type: "CLEAR_IMAGE" });
  }, [dispatch]);

  const loadImage = useCallback(
    (file: File) => {
      setPolygonPoints([]);
      setMaskHistory(emptyMaskHistory());
      void loadImageFile(file);
    },
    [loadImageFile]
  );

  const currentMask = useCallback(() => {
    const { workingWidth, workingHeight } = state.session.image;
    return state.session.maskImageData instanceof Uint8ClampedArray
      ? state.session.maskImageData
      : resetMaskBuffer(workingWidth, workingHeight);
  }, [state.session.image, state.session.maskImageData]);

  const commitMaskChange = useCallback(
    (mask: Uint8ClampedArray) => {
      const previous = currentMask();
      setMaskHistory((history) => pushMaskHistory(history, previous, mask));
      dispatch({ type: "SET_MASK_BUFFER", buffer: mask });
    },
    [currentMask, dispatch]
  );

  const commitMask = useCallback(
    (mask: Uint8ClampedArray) => {
      commitMaskChange(mask);
    },
    [commitMaskChange]
  );

  const resetMask = useCallback(() => {
    const { workingWidth, workingHeight } = state.session.image;
    const nextMask = resetMaskBuffer(workingWidth, workingHeight);
    setPolygonPoints([]);
    commitMaskChange(nextMask);
  }, [commitMaskChange, state.session.image]);

  const undoMask = useCallback(() => {
    const result = undoMaskHistory(maskHistory, currentMask());
    if (!result.mask) return;
    setPolygonPoints([]);
    setMaskHistory(result.history);
    dispatch({ type: "SET_MASK_BUFFER", buffer: result.mask });
  }, [currentMask, dispatch, maskHistory]);

  const redoMask = useCallback(() => {
    const result = redoMaskHistory(maskHistory, currentMask());
    if (!result.mask) return;
    setPolygonPoints([]);
    setMaskHistory(result.history);
    dispatch({ type: "SET_MASK_BUFFER", buffer: result.mask });
  }, [currentMask, dispatch, maskHistory]);

  const selectTool = useCallback(
    (tool: MaskTool) => {
      setActiveTool(tool);
      if (tool === "brush") dispatch({ type: "SET_BRUSH_MODE", mode: "paint" });
      if (tool === "eraser") dispatch({ type: "SET_BRUSH_MODE", mode: "erase" });
      if (tool !== "polygon-add" && tool !== "polygon-remove") setPolygonPoints([]);
    },
    [dispatch]
  );

  const fillArea = useCallback(
    (point: SmartMaskPoint, mode: MaskApplyMode) => {
      const { sourceImageData, workingWidth, workingHeight } = state.session.image;
      if (!sourceImageData || workingWidth <= 0 || workingHeight <= 0) return;

      commitMaskChange(edgeAwareAreaFill({
          sourceImageData,
          mask: currentMask(),
          seed: point,
          mode,
          colorTolerance: fillTolerance,
          edgeThreshold: 42,
          opacity: state.session.brush.opacity,
        }));
    },
    [commitMaskChange, currentMask, fillTolerance, state.session.brush.opacity, state.session.image]
  );

  const addPolygonPoint = useCallback((point: SmartMaskPoint) => {
    setPolygonPoints((points) => [...points, point]);
  }, []);

  const applyPolygon = useCallback(() => {
    const { workingWidth, workingHeight } = state.session.image;
    if (polygonPoints.length < 3 || workingWidth <= 0 || workingHeight <= 0) return;

    commitMaskChange(applyPolygonToMask({
        mask: currentMask(),
        width: workingWidth,
        height: workingHeight,
        points: polygonPoints,
        mode: activeTool === "polygon-remove" ? "remove" : "add",
        opacity: state.session.brush.opacity,
      }));
    setPolygonPoints([]);
  }, [activeTool, commitMaskChange, currentMask, polygonPoints, state.session.brush.opacity, state.session.image]);

  const downloadResult = useCallback(async () => {
    setExportError(null);
    const sourceImageData = state.session.image.sourceImageData;
    if (!sourceImageData || !canDownload) return;

    try {
      const exportImage = composeExportImage({
        sourceImageData,
        resultImageData: state.session.resultImageData,
        mask: state.session.maskImageData,
      });
      const canvas = document.createElement("canvas");
      canvas.width = exportImage.width;
      canvas.height = exportImage.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Could not create export canvas.");
      context.putImageData(exportImage, 0, 0);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((nextBlob) => {
          if (nextBlob) resolve(nextBlob);
          else reject(new Error("Could not encode export image."));
        }, "image/png");
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = createExportFilename();
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Could not export the simulated image.");
    }
  }, [canDownload, state.session.image.sourceImageData, state.session.maskImageData, state.session.resultImageData]);

  const toolButtonClass = (tool: MaskTool) =>
    `rounded-md border px-3 py-2 text-xs font-medium ${
      activeTool === tool ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-700"
    }`;

  const actionButtonClass = "min-h-10 rounded-md border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-6 py-4">
        <PaintBucket className="h-6 w-6 text-blue-500" />
        <h1 className="text-lg font-semibold tracking-tight">ChromaMatch</h1>
        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
          MVP
        </span>
      </header>

      <main className="flex flex-1 flex-col overflow-hidden md:flex-row">
        <aside className="w-full space-y-4 overflow-y-auto border-b border-gray-200 bg-white p-4 md:w-72 md:border-b-0 md:border-r">
          <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">Source image</h2>
            <p className="mb-3 mt-1 text-xs text-gray-500">
              Upload a room photo for local browser processing.
            </p>
            <ImageUpload
              onFile={loadImage}
              hasImage={hasImage}
              onClear={clearImage}
              fileName={upload.fileName}
              isLoading={upload.isLoading}
              error={upload.error}
            />
          </section>

          <PaintInput
            title="Current paint"
            description="Paint A: the known wall color in the photo."
            onPaintChange={setPaintA}
          />
          <PaintInput
            title="Target paint"
            description="Paint B: the new color to preview later."
            onPaintChange={setPaintB}
          />
          <FixturePanel />

          <section className="space-y-2 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">Quality status</h2>
            <p className="rounded-md bg-blue-50 p-3 text-xs text-blue-700">
              Local browser processing: enabled. Photos are not uploaded.
            </p>
            <div className="rounded-md bg-gray-50 p-3 text-xs text-gray-700">
              <label className="block font-medium text-gray-900" htmlFor="simulation-mode">
                Simulation mode
              </label>
              <select
                id="simulation-mode"
                className="mt-2 w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-xs"
                value={state.session.simulationMode}
                onChange={(event) =>
                  dispatch({
                    type: "SET_SIMULATION_MODE",
                    mode: event.target.value === "rgb-ratio-debug" ? "rgb-ratio-debug" : "lab-delta-d50",
                  })
                }
              >
                <option value="lab-delta-d50">LAB D50 delta (default)</option>
                <option value="rgb-ratio-debug">RGB ratio debug</option>
              </select>
            </div>
            <p className="rounded-md bg-blue-50 p-3 text-xs text-blue-700">
              Simulation status: {simulation.status}.
              {simulation.metadata
                ? ` Affected ${simulation.metadata.affectedPixelCount} pixels; clipped ${simulation.metadata.clippedPixelCount}.`
                : " Add an image, valid paints, and a mask to run preview."}
            </p>
            <div className="rounded-md bg-gray-50 p-3 text-xs text-gray-700">
              <h3 className="font-medium text-gray-900">Workflow readiness</h3>
              {readiness.canSimulate ? (
                <p className="mt-2 text-green-700">Ready to simulate with LAB D50 delta transfer.</p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {readiness.blockers.map((blocker) => (
                    <li key={blocker.id}>{blocker.message}</li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </aside>

        <div className="flex flex-1 flex-col overflow-hidden bg-gray-50 p-4 md:p-6">
          <div ref={workspaceRef} className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
          {upload.isLoading ? (
            <div className="rounded-lg border border-gray-200 bg-white px-6 py-8 text-center shadow-sm">
              <p className="text-sm font-medium text-gray-700">Decoding photo locally...</p>
              <p className="mt-2 text-xs text-gray-500">Your photo stays in your browser.</p>
            </div>
          ) : hasImage ? (
            <EditorCanvas
              sourceImageData={state.session.image.sourceImageData!}
              resultImageData={state.session.resultImageData}
              mask={state.session.maskImageData}
              workingWidth={state.session.image.workingWidth}
              workingHeight={state.session.image.workingHeight}
              displayWidth={state.session.image.displayWidth}
              displayHeight={state.session.image.displayHeight}
              brush={state.session.brush}
              activeTool={activeTool}
              viewMode={viewMode}
              showMaskOverlay={showMaskOverlay}
              polygonPoints={polygonPoints}
              onMaskCommit={commitMask}
              onAreaFill={fillArea}
              onPolygonPoint={addPolygonPoint}
            />
          ) : (
            <div className="max-w-sm rounded-lg border border-gray-200 bg-white px-8 py-10 text-center shadow-sm">
              <p className="text-sm font-semibold text-gray-900">Start with a room photo</p>
              <p className="mt-2 text-sm text-gray-600">
                Upload a JPG, PNG, WebP, HEIC, or HEIF. ChromaMatch decodes it locally in your browser; your photo is not uploaded.
              </p>
            </div>
          )}
          </div>
          {hasImage ? (
            <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Result controls</h2>
                  <p className="mt-1 text-xs text-gray-500">
                    Compare source and simulated pixels, then export the local working-size PNG without mask overlays.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className={viewMode === "before" ? `${toolButtonClass("brush")} border-blue-500 bg-blue-50 text-blue-700` : actionButtonClass}
                    onClick={() => setViewMode("before")}
                  >
                    Before
                  </button>
                  <button
                    type="button"
                    className={viewMode === "after" ? `${toolButtonClass("brush")} border-blue-500 bg-blue-50 text-blue-700` : actionButtonClass}
                    disabled={!state.session.resultImageData}
                    onClick={() => setViewMode("after")}
                  >
                    After
                  </button>
                  <button type="button" className={actionButtonClass} disabled={!canDownload} onClick={downloadResult}>
                    Download PNG
                  </button>
                </div>
              </div>
              {!canDownload ? (
                <p className="mt-3 text-xs text-gray-500">
                  Export unlocks after the image, both paints, a non-empty mask, and a completed simulation are ready.
                </p>
              ) : null}
              {exportError ? <p className="mt-3 text-xs text-red-600">{exportError}</p> : null}
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
              <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 pb-3">
                <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Mask tools</span>
                <button type="button" className={toolButtonClass("brush")} onClick={() => selectTool("brush")}>Brush</button>
                <button type="button" className={toolButtonClass("eraser")} onClick={() => selectTool("eraser")}>Eraser</button>
                <button type="button" className={toolButtonClass("edge-add")} onClick={() => selectTool("edge-add")}>Edge fill</button>
                <button type="button" className={toolButtonClass("edge-remove")} onClick={() => selectTool("edge-remove")}>Edge remove</button>
                <button type="button" className={toolButtonClass("polygon-add")} onClick={() => selectTool("polygon-add")}>Poly add</button>
                <button type="button" className={toolButtonClass("polygon-remove")} onClick={() => selectTool("polygon-remove")}>Poly remove</button>
              </div>
              <div className="flex flex-col gap-3 pt-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="grid gap-3 md:grid-cols-3 xl:flex xl:flex-1 xl:items-center">
                  <label className="text-xs font-medium text-gray-700 xl:min-w-44">
                    Size: {state.session.brush.sizePx}px
                    <input
                      className="mt-1 w-full"
                      type="range"
                      min="4"
                      max="128"
                      value={state.session.brush.sizePx}
                      onChange={(event) => dispatch({ type: "SET_BRUSH_SIZE", size: Number(event.target.value) })}
                    />
                  </label>
                  <label className="text-xs font-medium text-gray-700 xl:min-w-44">
                    Opacity: {Math.round(state.session.brush.opacity * 100)}%
                    <input
                      className="mt-1 w-full"
                      type="range"
                      min="0.1"
                      max="1"
                      step="0.1"
                      value={state.session.brush.opacity}
                      onChange={(event) => dispatch({ type: "SET_BRUSH_OPACITY", opacity: Number(event.target.value) })}
                    />
                  </label>
                  <label className="text-xs font-medium text-gray-700 xl:min-w-44">
                    Edge tolerance: {fillTolerance}
                    <input
                      className="mt-1 w-full"
                      type="range"
                      min="8"
                      max="96"
                      value={fillTolerance}
                      onChange={(event) => setFillTolerance(Number(event.target.value))}
                    />
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className={actionButtonClass} disabled={maskHistory.past.length === 0} onClick={undoMask}>Undo</button>
                  <button type="button" className={actionButtonClass} disabled={maskHistory.future.length === 0} onClick={redoMask}>Redo</button>
                  <button type="button" className={actionButtonClass} onClick={() => setShowMaskOverlay((visible) => !visible)}>
                    {showMaskOverlay ? "Hide overlay" : "Show overlay"}
                  </button>
                  <button type="button" className={actionButtonClass} onClick={resetMask}>Reset mask</button>
                  <button type="button" className={actionButtonClass} disabled={polygonPoints.length < 3} onClick={applyPolygon}>Apply polygon</button>
                  <button type="button" className={actionButtonClass} disabled={polygonPoints.length === 0} onClick={() => setPolygonPoints([])}>Reset polygon</button>
                </div>
              </div>
              <p className="mt-3 text-xs text-gray-500">
                {activeTool.startsWith("edge")
                  ? "Click once inside a wall-like area to fill or remove the detected region."
                  : activeTool.startsWith("polygon")
                    ? `Pinned vertices: ${polygonPoints.length}. Click the image to add points, then apply.`
                    : "Drag on the image to paint or erase the mask manually."}
              </p>
            </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}

export default App;
