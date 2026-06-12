import { PaintBucket, ShieldCheck, SlidersHorizontal, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ComparisonPreview, type PreviewMode } from "./components/ComparisonPreview";
import { EditorCanvas, type CanvasViewMode, type MaskTool } from "./components/EditorCanvas";
import { ImageUpload } from "./components/ImageUpload";
import { PaintInput } from "./components/PaintInput";
import { useEditorSession } from "./hooks/useEditorSession";
import { useSimulationWorker } from "./hooks/useSimulationWorker";
import type { PaintColor, SimulationMode } from "./types/session";
import { composeExportImage, createExportFilename } from "./utils/export";
import { resetMaskBuffer } from "./utils/mask";
import { emptyMaskHistory, pushMaskHistory, redoMaskHistory, undoMaskHistory, type MaskHistory } from "./utils/maskHistory";
import { applyPolygonToMask, edgeAwareAreaFill, type MaskApplyMode, type SmartMaskPoint } from "./utils/smartMask";
import { getWorkflowReadiness } from "./utils/workflow";

type GuidedStep = "photo" | "wall" | "colors" | "preview";

const guidedSteps: Array<{ id: GuidedStep; label: string; description: string }> = [
  { id: "photo", label: "Photo", description: "Upload room" },
  { id: "wall", label: "Wall", description: "Select area" },
  { id: "colors", label: "Colors", description: "Current to target" },
  { id: "preview", label: "Preview", description: "First result" },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function samePaint(a: PaintColor | null, b: PaintColor | null) {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.hex === b.hex && a.lrv === b.lrv;
}

function paintSignature(paint: PaintColor | null) {
  if (!paint) return "paint:none";
  return [paint.hex, paint.rgb.r, paint.rgb.g, paint.rgb.b, paint.lrv].join(":");
}

function App() {
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const previewStartTimerRef = useRef<number | null>(null);
  const [guidedStep, setGuidedStep] = useState<GuidedStep>("photo");
  const [firstPreviewComplete, setFirstPreviewComplete] = useState(false);
  const [isWallEditMode, setIsWallEditMode] = useState(false);
  const [isPaintDrawerOpen, setIsPaintDrawerOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("split");
  const [showMaskOverlay, setShowMaskOverlay] = useState(true);
  const [activeTool, setActiveTool] = useState<MaskTool>("edge-add");
  const [fillTolerance, setFillTolerance] = useState(34);
  const [polygonPoints, setPolygonPoints] = useState<SmartMaskPoint[]>([]);
  const [maskHistory, setMaskHistory] = useState<MaskHistory>(emptyMaskHistory);
  const [viewMode, setViewMode] = useState<CanvasViewMode>("after");
  const [latestPreviewSignature, setLatestPreviewSignature] = useState<string | null>(null);
  const [maskRevision, setMaskRevision] = useState(0);
  const [isPreviewStartPending, setIsPreviewStartPending] = useState(false);
  const [previewRunKey, setPreviewRunKey] = useState(0);
  const [completedRunKey, setCompletedRunKey] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);
  const { state, dispatch, loadImageFile, upload } = useEditorSession(workspaceRef);
  const readiness = getWorkflowReadiness(state.session);
  const hasImage = state.session.image.sourceImageData !== null;
  const hasMask = !readiness.blockers.some((blocker) => blocker.id === "mask");
  const hasPaints = Boolean(state.session.paintA && state.session.paintB);
  const { sourceImageData, workingWidth, workingHeight } = state.session.image;
  const currentPreviewSignature = useMemo(() => {
    if (!readiness.canSimulate) return null;
    return [
      `image:${workingWidth}x${workingHeight}:${sourceImageData?.data.length ?? 0}`,
      `mask:${maskRevision}`,
      paintSignature(state.session.paintA),
      paintSignature(state.session.paintB),
      `mode:${state.session.simulationMode}`,
    ].join("|");
  }, [maskRevision, readiness.canSimulate, sourceImageData, state.session.paintA, state.session.paintB, state.session.simulationMode, workingHeight, workingWidth]);
  const pendingManualPreview = previewRunKey > completedRunKey;
  const shouldRunSimulation = readiness.canSimulate && pendingManualPreview;
  const simulation = useSimulationWorker(state.session, dispatch, {
    enabled: shouldRunSimulation,
    preserveResultWhenBlocked: firstPreviewComplete,
    runKey: previewRunKey,
  });
  const previewIsRendering = isPreviewStartPending || simulation.status === "running";
  const previewNeedsUpdate = firstPreviewComplete && latestPreviewSignature !== currentPreviewSignature;
  const canDownload = firstPreviewComplete && !previewNeedsUpdate && !previewIsRendering && readiness.canExport && simulation.status === "complete";
  const displayViewMode: CanvasViewMode = state.session.resultImageData && (viewMode === "after" || previewMode !== "toggle") ? "after" : "before";

  useEffect(() => {
    if (!state.session.resultImageData && viewMode === "after") setViewMode("before");
  }, [state.session.resultImageData, viewMode]);

  useEffect(() => {
    if (simulation.status !== "complete" || simulation.requestId === 0 || !state.session.resultImageData) return;
    if (simulation.runKey !== previewRunKey || previewRunKey <= completedRunKey) return;
    setFirstPreviewComplete(true);
    setGuidedStep("preview");
    setIsWallEditMode(false);
    setLatestPreviewSignature(currentPreviewSignature);
    setCompletedRunKey(previewRunKey);
    setIsPreviewStartPending(false);
    setViewMode("after");
  }, [completedRunKey, currentPreviewSignature, previewRunKey, simulation.requestId, simulation.runKey, simulation.status, state.session.resultImageData]);

  useEffect(() => {
    return () => {
      if (previewStartTimerRef.current !== null) window.clearTimeout(previewStartTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (simulation.status === "error" || simulation.status === "blocked") {
      setIsPreviewStartPending(false);
    }
  }, [simulation.status]);

  const setPaintA = useCallback(
    (paint: PaintColor | null) => {
      if (samePaint(state.session.paintA, paint)) return;
      dispatch(paint ? { type: "SET_PAINT_A", paint } : { type: "CLEAR_PAINT_A" });
    },
    [dispatch, state.session.paintA]
  );

  const setPaintB = useCallback(
    (paint: PaintColor | null) => {
      if (samePaint(state.session.paintB, paint)) return;
      dispatch(paint ? { type: "SET_PAINT_B", paint } : { type: "CLEAR_PAINT_B" });
    },
    [dispatch, state.session.paintB]
  );

  const resetPreviewState = useCallback(() => {
    setFirstPreviewComplete(false);
    setIsWallEditMode(false);
    setIsPaintDrawerOpen(false);
    setGuidedStep("photo");
    setLatestPreviewSignature(null);
    setMaskRevision(0);
    setPreviewRunKey(0);
    setCompletedRunKey(0);
    setViewMode("before");
  }, []);

  const clearImage = useCallback(() => {
    setPolygonPoints([]);
    setMaskHistory(emptyMaskHistory());
    resetPreviewState();
    dispatch({ type: "CLEAR_IMAGE" });
  }, [dispatch, resetPreviewState]);

  const loadImage = useCallback(
    (file: File) => {
      setPolygonPoints([]);
      setMaskHistory(emptyMaskHistory());
      resetPreviewState();
      void loadImageFile(file);
    },
    [loadImageFile, resetPreviewState]
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
      setMaskRevision((revision) => revision + 1);
    },
    [currentMask, dispatch]
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
    setMaskRevision((revision) => revision + 1);
  }, [currentMask, dispatch, maskHistory]);

  const redoMask = useCallback(() => {
    const result = redoMaskHistory(maskHistory, currentMask());
    if (!result.mask) return;
    setPolygonPoints([]);
    setMaskHistory(result.history);
    dispatch({ type: "SET_MASK_BUFFER", buffer: result.mask });
    setMaskRevision((revision) => revision + 1);
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

  const beginPreviewRender = useCallback(() => {
    if (!readiness.canSimulate) return;
    setIsPaintDrawerOpen(false);
    setIsWallEditMode(false);
    setIsPreviewStartPending(true);
    if (previewStartTimerRef.current !== null) window.clearTimeout(previewStartTimerRef.current);
    previewStartTimerRef.current = window.setTimeout(() => {
      previewStartTimerRef.current = null;
      setPreviewRunKey((key) => key + 1);
    }, 50);
  }, [readiness.canSimulate]);

  const setSimulationMode = useCallback(
    (mode: SimulationMode) => {
      if (state.session.simulationMode === mode) return;
      dispatch({ type: "SET_SIMULATION_MODE", mode });
    },
    [dispatch, state.session.simulationMode]
  );

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

  const canOpenStep = useCallback(
    (step: GuidedStep) => {
      if (step === "photo") return true;
      if (step === "wall") return hasImage;
      if (step === "colors") return hasImage && hasMask;
      return firstPreviewComplete;
    },
    [firstPreviewComplete, hasImage, hasMask]
  );

  const openGuidedStep = useCallback(
    (step: GuidedStep) => {
      if (canOpenStep(step)) setGuidedStep(step);
    },
    [canOpenStep]
  );

  const toolButtonClass = (tool: MaskTool) =>
    cx(
      "min-h-11 rounded-md border px-3 py-2 text-xs font-semibold transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-200",
      activeTool === tool ? "border-teal-500 bg-teal-50 text-teal-800" : "border-slate-200 text-slate-700 hover:bg-slate-50"
    );

  const actionButtonClass = "min-h-11 rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-teal-200 cursor-pointer";
  const primaryButtonClass = "min-h-11 rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-300 cursor-pointer";

  const renderCanvas = () => {
    if (upload.isLoading) {
      return (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-8 text-center shadow-sm">
          <p className="text-sm font-semibold text-slate-700">Decoding photo locally...</p>
          <p className="mt-2 text-xs text-slate-500">Your photo stays in your browser.</p>
        </div>
      );
    }

    if (!hasImage || !state.session.image.sourceImageData) {
      return (
        <div className="max-w-sm rounded-xl border border-slate-200 bg-white px-8 py-10 text-center shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Start with a room photo</p>
          <p className="mt-2 text-sm text-slate-600">
            Upload a room photo, select the wall, then preview the new paint locally.
          </p>
        </div>
      );
    }

    return (
      <EditorCanvas
        sourceImageData={state.session.image.sourceImageData}
        resultImageData={state.session.resultImageData}
        mask={state.session.maskImageData}
        workingWidth={state.session.image.workingWidth}
        workingHeight={state.session.image.workingHeight}
        displayWidth={state.session.image.displayWidth}
        displayHeight={state.session.image.displayHeight}
        brush={state.session.brush}
        activeTool={activeTool}
        viewMode={displayViewMode}
        showMaskOverlay={showMaskOverlay && (isWallEditMode || !firstPreviewComplete || simulation.status === "running")}
        polygonPoints={polygonPoints}
        onMaskCommit={commitMaskChange}
        onAreaFill={fillArea}
        onPolygonPoint={addPolygonPoint}
      />
    );
  };

  const renderPhotoStepPreview = () => {
    if (upload.isLoading || !hasImage || !state.session.image.sourceImageData) return renderCanvas();

    return (
      <ComparisonPreview
        sourceImageData={state.session.image.sourceImageData}
        resultImageData={null}
        mask={null}
        workingWidth={state.session.image.workingWidth}
        workingHeight={state.session.image.workingHeight}
        displayWidth={state.session.image.displayWidth}
        displayHeight={state.session.image.displayHeight}
        mode="toggle"
        toggleViewMode="before"
      />
    );
  };

  const renderRenderingPreviewSurface = () => {
    if (!hasImage || !state.session.image.sourceImageData) return renderCanvas();

    return (
      <ComparisonPreview
        sourceImageData={state.session.image.sourceImageData}
        resultImageData={null}
        mask={state.session.maskImageData}
        workingWidth={state.session.image.workingWidth}
        workingHeight={state.session.image.workingHeight}
        displayWidth={state.session.image.displayWidth}
        displayHeight={state.session.image.displayHeight}
        mode="toggle"
        toggleViewMode="before"
      />
    );
  };

  const renderMaskTools = () => (
    <MaskToolsPanel
      actionButtonClass={actionButtonClass}
      activeTool={activeTool}
      applyPolygon={applyPolygon}
      fillTolerance={fillTolerance}
      maskHistory={maskHistory}
      polygonPoints={polygonPoints}
      resetMask={resetMask}
      resetPolygon={() => setPolygonPoints([])}
      redoMask={redoMask}
      selectTool={selectTool}
      setFillTolerance={setFillTolerance}
      setShowMaskOverlay={setShowMaskOverlay}
      showMaskOverlay={showMaskOverlay}
      toolButtonClass={toolButtonClass}
      undoMask={undoMask}
      brushSize={state.session.brush.sizePx}
      brushOpacity={state.session.brush.opacity}
      setBrushSize={(size) => dispatch({ type: "SET_BRUSH_SIZE", size })}
      setBrushOpacity={(opacity) => dispatch({ type: "SET_BRUSH_OPACITY", opacity })}
    />
  );

  const renderGuidedAside = () => {
    if (guidedStep === "photo") {
      return (
        <aside className="w-full overflow-y-auto border-l border-slate-200 bg-white p-5 md:w-96">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Upload photo</h2>
            <p className="mb-3 mt-1 text-sm text-slate-600">Use a clear room photo where the wall is visible.</p>
            <ImageUpload
              onFile={loadImage}
              hasImage={hasImage}
              onClear={clearImage}
              fileName={upload.fileName}
              isLoading={upload.isLoading}
              error={upload.error}
            />
          </section>
          <section className="mt-4 rounded-xl border border-teal-100 bg-teal-50 p-4 text-sm text-teal-900">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="h-4 w-4" />
              Local browser processing
            </div>
            <p className="mt-2 text-teal-800">Photos are decoded and processed locally. Nothing is uploaded.</p>
          </section>
          <section className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <h3 className="font-semibold text-slate-900">Photo quality tips</h3>
            <p className="mt-2">Use good light, keep the target wall visible, and avoid blurry photos.</p>
          </section>
        </aside>
      );
    }

    if (guidedStep === "wall") return renderMaskTools();

    if (guidedStep === "colors") {
      return (
        <aside className="w-full overflow-y-auto border-l border-slate-200 bg-white p-5 md:w-[28rem]">
          <PaintsPanel
            paintA={state.session.paintA}
            paintB={state.session.paintB}
            setPaintA={setPaintA}
            setPaintB={setPaintB}
          />
          <PreviewStatusCard
            readiness={readiness.blockers.map((blocker) => blocker.message)}
            simulationStatus={simulation.status}
            metadata={simulation.metadata}
            previewNeedsUpdate={previewNeedsUpdate}
          />
        </aside>
      );
    }

    return null;
  };

  const renderGuidedPrimary = () => {
    if (previewIsRendering) return renderRenderingPreviewSurface();

    if (guidedStep === "photo") return renderPhotoStepPreview();

    if (guidedStep === "colors") {
      return (
        <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Step 3</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Enter both paint colors</h2>
          <p className="mt-2 text-sm text-slate-600">
            Current paint calibrates the photographed wall. Target paint defines the color transfer.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
            <SwatchCard label="Current" paint={state.session.paintA} />
            <span className="hidden text-sm font-semibold text-slate-400 md:block">to</span>
            <SwatchCard label="Target" paint={state.session.paintB} />
          </div>
          <p className="mt-6 rounded-xl border border-teal-100 bg-teal-50 p-4 text-sm text-teal-900">
            Preview uses LAB D50 delta transfer to preserve photographed lighting, shadows, and wall texture.
          </p>
        </div>
      );
    }

    return renderCanvas();
  };

  const renderGuidedFooter = () => {
    if (guidedStep === "photo") {
      return (
        <FooterBar
          status={hasImage ? "Photo ready. Continue to select the wall." : "Upload a room photo to begin."}
          primaryLabel="Continue to wall selection"
          primaryDisabled={!hasImage}
          primaryClass={primaryButtonClass}
          onPrimary={() => setGuidedStep("wall")}
        />
      );
    }

    if (guidedStep === "wall") {
      return (
        <FooterBar
          status={hasMask ? "Wall area selected. Continue to paint colors." : "Click inside the wall, then refine the mask if needed."}
          primaryLabel="Continue to paint colors"
          primaryDisabled={!hasMask}
          primaryClass={primaryButtonClass}
          onPrimary={() => setGuidedStep("colors")}
        />
      );
    }

    if (guidedStep === "colors") {
      const status = !hasPaints
        ? "Enter valid current and target paint colors to generate the first preview."
        : previewIsRendering
          ? "Generating first preview locally..."
          : readiness.canSimulate
            ? "Paint colors are ready. Generate the first preview when you are ready."
            : readiness.blockers.map((blocker) => blocker.message).join(" ");
      return (
        <FooterBar
          status={status}
          primaryLabel={previewIsRendering ? "Generating preview..." : readiness.canSimulate ? "Generate preview" : "Complete paint colors"}
          primaryDisabled={!readiness.canSimulate || previewIsRendering}
          primaryClass={primaryButtonClass}
          onPrimary={beginPreviewRender}
        />
      );
    }

    return null;
  };

  const renderActiveEditor = () => (
    <>
      <div className="absolute left-4 top-4 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white/95 p-2 shadow-sm backdrop-blur">
        <button type="button" className={previewMode === "toggle" && viewMode === "before" ? activeToggleClass : inactiveToggleClass} onClick={() => { setPreviewMode("toggle"); setViewMode("before"); }}>
          Before
        </button>
        <button type="button" className={viewMode === "after" && previewMode === "toggle" ? activeToggleClass : inactiveToggleClass} onClick={() => { setPreviewMode("toggle"); setViewMode("after"); }} disabled={!state.session.resultImageData}>
          After
        </button>
        <button type="button" className={previewMode === "split" ? activeToggleClass : inactiveToggleClass} onClick={() => setPreviewMode("split")} disabled={!state.session.resultImageData}>
          Split
        </button>
        <button type="button" className={previewMode === "side-by-side" ? activeToggleClass : inactiveToggleClass} onClick={() => setPreviewMode("side-by-side")} disabled={!state.session.resultImageData}>
          Side by side
        </button>
      </div>
      <StatusChip
        className="absolute right-4 top-4 z-10"
        label={previewIsRendering ? "Updating locally" : previewNeedsUpdate ? "Preview needs update" : "Preview ready"}
        tone={previewIsRendering ? "blue" : previewNeedsUpdate ? "amber" : "green"}
      />
      {previewIsRendering ? renderRenderingPreviewSurface() : hasImage && state.session.image.sourceImageData ? (
        <ComparisonPreview
          sourceImageData={state.session.image.sourceImageData}
          resultImageData={previewIsRendering ? null : state.session.resultImageData}
          mask={state.session.maskImageData}
          workingWidth={state.session.image.workingWidth}
          workingHeight={state.session.image.workingHeight}
          displayWidth={state.session.image.displayWidth}
          displayHeight={state.session.image.displayHeight}
          mode={previewMode}
          toggleViewMode={viewMode}
        />
      ) : renderCanvas()}
      {previewIsRendering ? <RenderingOverlay /> : null}
      {isPaintDrawerOpen ? (
        <PaintDrawer
          canUpdate={readiness.canSimulate && previewNeedsUpdate && !previewIsRendering}
          metadata={simulation.metadata}
          onClose={() => setIsPaintDrawerOpen(false)}
          onUpdate={beginPreviewRender}
          paintA={state.session.paintA}
          paintB={state.session.paintB}
          previewNeedsUpdate={previewNeedsUpdate}
          readinessMessages={readiness.blockers.map((blocker) => blocker.message)}
          setPaintA={setPaintA}
          setPaintB={setPaintB}
          setSimulationMode={setSimulationMode}
          simulationMode={state.session.simulationMode}
          simulationStatus={isPreviewStartPending ? "starting" : simulation.status}
          workingHeight={state.session.image.workingHeight}
          workingWidth={state.session.image.workingWidth}
        />
      ) : null}
    </>
  );

  const renderWallEditMode = () => (
    <>
      <div className="absolute left-4 top-4 z-10 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Edit wall selection</p>
        <p className="mt-1 text-sm text-slate-700">Use smart select first, then refine the mask.</p>
      </div>
      {renderCanvas()}
    </>
  );

  return (
    <div className="flex h-screen flex-col bg-slate-50 text-slate-950">
      <header className="flex shrink-0 flex-col border-b border-slate-200 bg-white">
        <div className="flex min-h-16 flex-wrap items-center gap-3 px-4 py-3 md:px-6">
          <PaintBucket className="h-6 w-6 text-teal-700" />
          <h1 className="text-lg font-semibold tracking-tight">ChromaMatch</h1>
          <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800">
            <ShieldCheck className="h-3.5 w-3.5" />
            Local only
          </span>
          <StatusChip
            label={firstPreviewComplete ? previewIsRendering ? "Updating" : previewNeedsUpdate ? "Needs update" : "Preview ready" : hasImage ? "Photo loaded" : "No photo"}
            tone={firstPreviewComplete && previewIsRendering ? "blue" : firstPreviewComplete && previewNeedsUpdate ? "amber" : firstPreviewComplete ? "green" : "blue"}
          />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {firstPreviewComplete ? (
              <>
                <button type="button" className={actionButtonClass} onClick={() => setIsPaintDrawerOpen(true)}>Paints</button>
                <button type="button" className={actionButtonClass} onClick={() => { setIsWallEditMode(true); setIsPaintDrawerOpen(false); setShowMaskOverlay(true); }}>Edit wall</button>
                {previewNeedsUpdate ? <button type="button" className={primaryButtonClass} disabled={!readiness.canSimulate || previewIsRendering} onClick={beginPreviewRender}>Update preview</button> : null}
                <button type="button" className={actionButtonClass} disabled={!canDownload} onClick={downloadResult}>Download PNG</button>
                <button type="button" className={actionButtonClass} onClick={clearImage}>New photo</button>
              </>
            ) : null}
            {isWallEditMode ? (
              <button type="button" className={primaryButtonClass} onClick={() => setIsWallEditMode(false)}>Return to preview</button>
            ) : null}
          </div>
        </div>
        {!firstPreviewComplete && !isWallEditMode ? (
          <WorkflowProgress currentStep={guidedStep} canOpenStep={canOpenStep} onStepSelect={openGuidedStep} />
        ) : null}
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <section ref={workspaceRef} className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-slate-100 p-4 md:p-6">
            {isWallEditMode ? renderWallEditMode() : firstPreviewComplete ? renderActiveEditor() : renderGuidedPrimary()}
            {previewIsRendering && !isWallEditMode && !firstPreviewComplete ? <RenderingOverlay /> : null}
          </section>
          {!firstPreviewComplete && !isWallEditMode ? renderGuidedAside() : null}
          {isWallEditMode ? renderMaskTools() : null}
        </div>
        {!firstPreviewComplete && !isWallEditMode ? renderGuidedFooter() : null}
        {isWallEditMode ? (
          <FooterBar
            status={previewNeedsUpdate ? "Wall selection changed. Return to preview and update the result." : "Refine the wall selection, then return to preview."}
            primaryLabel="Return to preview"
            primaryClass={primaryButtonClass}
            onPrimary={() => setIsWallEditMode(false)}
          />
        ) : null}
        {exportError ? <p className="border-t border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">{exportError}</p> : null}
      </main>
    </div>
  );
}

const activeToggleClass = "min-h-10 rounded-md bg-teal-700 px-3 py-2 text-xs font-semibold text-white transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-300";
const inactiveToggleClass = "min-h-10 rounded-md px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-200";

function WorkflowProgress({
  currentStep,
  canOpenStep,
  onStepSelect,
}: {
  currentStep: GuidedStep;
  canOpenStep: (step: GuidedStep) => boolean;
  onStepSelect: (step: GuidedStep) => void;
}) {
  return (
    <nav aria-label="Guided workflow progress" className="border-t border-slate-100 px-4 py-3 md:px-6">
      <ol className="grid gap-2 md:grid-cols-4">
        {guidedSteps.map((step, index) => {
          const isCurrent = step.id === currentStep;
          const isOpen = canOpenStep(step.id);
          return (
            <li key={step.id}>
              <button
                type="button"
                disabled={!isOpen}
                onClick={() => onStepSelect(step.id)}
                className={cx(
                  "flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-teal-200",
                  isCurrent ? "border-teal-500 bg-teal-50 text-teal-950" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                  !isOpen && "cursor-not-allowed opacity-50",
                  isOpen && "cursor-pointer"
                )}
              >
                <span className={cx("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold", isCurrent ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-600")}>{index + 1}</span>
                <span>
                  <span className="block text-sm font-semibold">{step.label}</span>
                  <span className="block text-xs text-slate-500">{step.description}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function FooterBar({
  status,
  primaryLabel,
  primaryDisabled,
  primaryClass,
  onPrimary,
}: {
  status: string;
  primaryLabel: string;
  primaryDisabled?: boolean;
  primaryClass: string;
  onPrimary?: () => void;
}) {
  return (
    <div className="flex shrink-0 flex-col gap-3 border-t border-slate-200 bg-white px-4 py-3 md:flex-row md:items-center md:justify-between md:px-6">
      <p className="text-sm text-slate-600">{status}</p>
      <button type="button" className={primaryClass} disabled={primaryDisabled} onClick={onPrimary}>{primaryLabel}</button>
    </div>
  );
}

function StatusChip({ label, tone, className }: { label: string; tone: "blue" | "green" | "amber"; className?: string }) {
  const toneClass = {
    blue: "border-blue-100 bg-blue-50 text-blue-800",
    green: "border-green-100 bg-green-50 text-green-800",
    amber: "border-amber-100 bg-amber-50 text-amber-800",
  }[tone];
  return <span className={cx("inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-semibold", toneClass, className)}>{label}</span>;
}

function RenderingOverlay() {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/10 backdrop-blur-[1px]">
      <div className="rounded-2xl border border-slate-200 bg-white/95 px-6 py-5 text-center shadow-xl">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-teal-100 border-t-teal-700" aria-hidden="true" />
        <p className="mt-3 text-sm font-semibold text-slate-900">Rendering new paint locally...</p>
        <p className="mt-1 text-xs text-slate-500">Using the current wall mask and paint values.</p>
      </div>
    </div>
  );
}

function SwatchCard({ label, paint }: { label: string; paint: PaintColor | null }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-3 flex items-center gap-3">
        <span className="h-12 w-12 rounded-lg border border-slate-200 bg-white" style={paint ? { backgroundColor: paint.hex } : undefined} aria-label={paint ? `${label} color ${paint.hex}` : `${label} color not set`} role="img" />
        <div>
          <p className="text-sm font-semibold text-slate-900">{paint?.hex ?? "Not set"}</p>
          <p className="text-xs text-slate-500">{paint ? `LRV ${paint.lrv.toFixed(1)}` : "Enter color and LRV"}</p>
        </div>
      </div>
    </div>
  );
}

function PaintsPanel({
  paintA,
  paintB,
  setPaintA,
  setPaintB,
}: {
  paintA: PaintColor | null;
  paintB: PaintColor | null;
  setPaintA: (paint: PaintColor | null) => void;
  setPaintB: (paint: PaintColor | null) => void;
}) {
  return (
    <div className="space-y-4">
      <PaintInput title="Current paint" description="Paint A: the known wall color in the photo." value={paintA} onPaintChange={setPaintA} />
      <PaintInput title="Target paint" description="Paint B: the new color to preview." value={paintB} onPaintChange={setPaintB} />
    </div>
  );
}

function PreviewStatusCard({
  readiness,
  simulationStatus,
  metadata,
  previewNeedsUpdate,
}: {
  readiness: string[];
  simulationStatus: string;
  metadata: { affectedPixelCount: number; clippedPixelCount: number } | null;
  previewNeedsUpdate: boolean;
}) {
  return (
    <section className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">Preview status</h2>
      <p className="rounded-lg bg-teal-50 p-3 text-xs text-teal-800">Local browser processing: enabled. Photos are not uploaded.</p>
      <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
        Simulation status: {previewNeedsUpdate ? "needs update" : simulationStatus}.
        {metadata ? ` Affected ${metadata.affectedPixelCount} pixels; clipped ${metadata.clippedPixelCount}.` : " Add an image, mask, and valid paints to run preview."}
      </p>
      {readiness.length > 0 ? (
        <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
          <h3 className="font-semibold text-slate-900">Workflow blockers</h3>
          <ul className="mt-2 space-y-1">
            {readiness.map((message) => <li key={message}>{message}</li>)}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function PaintDrawer({
  canUpdate,
  metadata,
  onClose,
  onUpdate,
  paintA,
  paintB,
  previewNeedsUpdate,
  readinessMessages,
  setPaintA,
  setPaintB,
  setSimulationMode,
  simulationMode,
  simulationStatus,
  workingHeight,
  workingWidth,
}: {
  canUpdate: boolean;
  metadata: { affectedPixelCount: number; clippedPixelCount: number } | null;
  onClose: () => void;
  onUpdate: () => void;
  paintA: PaintColor | null;
  paintB: PaintColor | null;
  previewNeedsUpdate: boolean;
  readinessMessages: string[];
  setPaintA: (paint: PaintColor | null) => void;
  setPaintB: (paint: PaintColor | null) => void;
  setSimulationMode: (mode: SimulationMode) => void;
  simulationMode: SimulationMode;
  simulationStatus: string;
  workingHeight: number;
  workingWidth: number;
}) {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <aside className="absolute bottom-0 right-0 top-0 z-20 w-full max-w-[26rem] overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-2xl">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Paints</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">Adjust paint colors</h2>
          <p className="mt-1 text-sm text-slate-600">Edit current and target colors, then update the preview.</p>
        </div>
        <button type="button" className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-200 cursor-pointer" onClick={onClose} aria-label="Close paint drawer">
          <X className="h-5 w-5" />
        </button>
      </div>
      <PaintsPanel paintA={paintA} paintB={paintB} setPaintA={setPaintA} setPaintB={setPaintB} />
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">Preview state</p>
        <p className="mt-1">{simulationStatus === "running" ? "Updating preview locally..." : previewNeedsUpdate ? "Changes are ready. Update preview when you are done editing." : `Current preview status: ${simulationStatus}.`}</p>
        <button type="button" className="mt-3 min-h-11 w-full rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-300 cursor-pointer" disabled={!canUpdate} onClick={onUpdate}>
          Update preview
        </button>
      </div>
      <AdvancedDiagnostics
        metadata={metadata}
        readinessMessages={readinessMessages}
        setSimulationMode={setSimulationMode}
        simulationMode={simulationMode}
        simulationStatus={simulationStatus}
        workingHeight={workingHeight}
        workingWidth={workingWidth}
      />
    </aside>
  );
}

function AdvancedDiagnostics({
  metadata,
  readinessMessages,
  setSimulationMode,
  simulationMode,
  simulationStatus,
  workingHeight,
  workingWidth,
}: {
  metadata: { affectedPixelCount: number; clippedPixelCount: number } | null;
  readinessMessages: string[];
  setSimulationMode: (mode: SimulationMode) => void;
  simulationMode: SimulationMode;
  simulationStatus: string;
  workingHeight: number;
  workingWidth: number;
}) {
  return (
    <details className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
      <summary className="cursor-pointer select-none font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-200">
        Advanced diagnostics
      </summary>
      <div className="mt-4 space-y-4">
        <label className="block text-sm font-semibold text-slate-700" htmlFor="simulation-mode">
          Simulation mode
          <select
            id="simulation-mode"
            className="mt-2 min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
            value={simulationMode}
            onChange={(event) => setSimulationMode(event.target.value === "rgb-ratio-debug" ? "rgb-ratio-debug" : "lab-delta-d50")}
          >
            <option value="lab-delta-d50">LAB D50 delta (default)</option>
            <option value="rgb-ratio-debug">RGB ratio debug</option>
          </select>
        </label>
        <dl className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-xs">
          <div>
            <dt className="font-semibold text-slate-500">Status</dt>
            <dd className="mt-1 text-slate-900">{simulationStatus}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">Working size</dt>
            <dd className="mt-1 text-slate-900">{workingWidth}x{workingHeight}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">Affected pixels</dt>
            <dd className="mt-1 text-slate-900">{metadata?.affectedPixelCount ?? "--"}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">Clipped pixels</dt>
            <dd className="mt-1 text-slate-900">{metadata?.clippedPixelCount ?? "--"}</dd>
          </div>
        </dl>
        {readinessMessages.length > 0 ? (
          <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            <p className="font-semibold">Current blockers</p>
            <ul className="mt-2 space-y-1">
              {readinessMessages.map((message) => <li key={message}>{message}</li>)}
            </ul>
          </div>
        ) : null}
      </div>
    </details>
  );
}

function MaskToolsPanel({
  actionButtonClass,
  activeTool,
  applyPolygon,
  fillTolerance,
  maskHistory,
  polygonPoints,
  resetMask,
  resetPolygon,
  redoMask,
  selectTool,
  setFillTolerance,
  setShowMaskOverlay,
  showMaskOverlay,
  toolButtonClass,
  undoMask,
  brushSize,
  brushOpacity,
  setBrushSize,
  setBrushOpacity,
}: {
  actionButtonClass: string;
  activeTool: MaskTool;
  applyPolygon: () => void;
  fillTolerance: number;
  maskHistory: MaskHistory;
  polygonPoints: SmartMaskPoint[];
  resetMask: () => void;
  resetPolygon: () => void;
  redoMask: () => void;
  selectTool: (tool: MaskTool) => void;
  setFillTolerance: (value: number) => void;
  setShowMaskOverlay: (update: (visible: boolean) => boolean) => void;
  showMaskOverlay: boolean;
  toolButtonClass: (tool: MaskTool) => string;
  undoMask: () => void;
  brushSize: number;
  brushOpacity: number;
  setBrushSize: (size: number) => void;
  setBrushOpacity: (opacity: number) => void;
}) {
  return (
    <aside className="w-full overflow-y-auto border-l border-slate-200 bg-white p-5 md:w-96">
      <section className="rounded-xl border border-teal-100 bg-teal-50 p-4 text-sm text-teal-900">
        <h2 className="font-semibold">Smart select</h2>
        <p className="mt-1">Click inside the wall first. Use refinement tools only if the selection needs correction.</p>
        <button type="button" className={cx("mt-3 w-full", toolButtonClass("edge-add"))} onClick={() => selectTool("edge-add")}>Smart select wall</button>
      </section>

      <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <SlidersHorizontal className="h-4 w-4 text-slate-500" />
          Refine mask
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" className={toolButtonClass("brush")} onClick={() => selectTool("brush")}>Brush</button>
          <button type="button" className={toolButtonClass("eraser")} onClick={() => selectTool("eraser")}>Eraser</button>
          <button type="button" className={toolButtonClass("polygon-add")} onClick={() => selectTool("polygon-add")}>Poly add</button>
          <button type="button" className={toolButtonClass("polygon-remove")} onClick={() => selectTool("polygon-remove")}>Poly remove</button>
        </div>
        <div className="mt-4 space-y-3">
          <label className="block text-xs font-semibold text-slate-700">
            Size: {brushSize}px
            <input className="mt-1 w-full" type="range" min="4" max="128" value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            Opacity: {Math.round(brushOpacity * 100)}%
            <input className="mt-1 w-full" type="range" min="0.1" max="1" step="0.1" value={brushOpacity} onChange={(event) => setBrushOpacity(Number(event.target.value))} />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            Edge tolerance: {fillTolerance}
            <input className="mt-1 w-full" type="range" min="8" max="96" value={fillTolerance} onChange={(event) => setFillTolerance(Number(event.target.value))} />
          </label>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" className={actionButtonClass} disabled={maskHistory.past.length === 0} onClick={undoMask}>Undo</button>
          <button type="button" className={actionButtonClass} disabled={maskHistory.future.length === 0} onClick={redoMask}>Redo</button>
          <button type="button" className={actionButtonClass} onClick={() => setShowMaskOverlay((visible) => !visible)}>{showMaskOverlay ? "Hide overlay" : "Show overlay"}</button>
          <button type="button" className={actionButtonClass} onClick={resetMask}>Reset mask</button>
          <button type="button" className={actionButtonClass} disabled={polygonPoints.length < 3} onClick={applyPolygon}>Apply polygon</button>
          <button type="button" className={actionButtonClass} disabled={polygonPoints.length === 0} onClick={resetPolygon}>Reset polygon</button>
        </div>
        <p className="mt-4 text-xs text-slate-500">
          {activeTool.startsWith("edge")
            ? "Click once inside a wall-like area to fill or remove the detected region."
            : activeTool.startsWith("polygon")
              ? `Pinned vertices: ${polygonPoints.length}. Click the image to add points, then apply.`
              : "Drag on the image to paint or erase the mask manually."}
        </p>
      </section>
    </aside>
  );
}

export default App;
