import { PaintBucket } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { EditorCanvas } from "./components/EditorCanvas";
import { FixturePanel } from "./components/FixturePanel";
import { ImageUpload } from "./components/ImageUpload";
import { PaintInput } from "./components/PaintInput";
import { useEditorSession } from "./hooks/useEditorSession";
import type { PaintColor } from "./types/session";
import { applyMaskBrush, createMaskBuffer, resetMaskBuffer } from "./utils/mask";

function App() {
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const maskRef = useRef<Uint8ClampedArray | null>(null);
  const [showMaskOverlay, setShowMaskOverlay] = useState(true);
  const { state, dispatch, loadImageFile, upload } = useEditorSession(workspaceRef);
  const hasImage = state.session.image.sourceImageData !== null;

  useEffect(() => {
    maskRef.current = state.session.maskImageData instanceof Uint8ClampedArray
      ? state.session.maskImageData
      : null;
  }, [state.session.maskImageData]);

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
    dispatch({ type: "CLEAR_IMAGE" });
  }, [dispatch]);

  const applyBrushStroke = useCallback(
    (point: { x: number; y: number }) => {
      const { workingWidth, workingHeight } = state.session.image;
      if (workingWidth <= 0 || workingHeight <= 0) return;

      const currentMask = maskRef.current ?? createMaskBuffer(workingWidth, workingHeight);
      const nextMask = applyMaskBrush(currentMask, workingWidth, workingHeight, {
        x: point.x,
        y: point.y,
        ...state.session.brush,
      });
      maskRef.current = nextMask;

      dispatch({
        type: "SET_MASK_BUFFER",
        buffer: nextMask,
      });
    },
    [dispatch, state.session.brush, state.session.image]
  );

  const resetMask = useCallback(() => {
    const { workingWidth, workingHeight } = state.session.image;
    const nextMask = resetMaskBuffer(workingWidth, workingHeight);
    maskRef.current = nextMask;
    dispatch({ type: "SET_MASK_BUFFER", buffer: nextMask });
  }, [dispatch, state.session.image]);

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
              onFile={loadImageFile}
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

          <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Mask tools</h2>
              <p className="mt-1 text-xs text-gray-500">
                Paint the wall area to preview in the next phase slice.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className={`rounded-md border px-3 py-2 text-xs font-medium ${
                  state.session.brush.mode === "paint"
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 text-gray-700"
                }`}
                onClick={() => dispatch({ type: "SET_BRUSH_MODE", mode: "paint" })}
              >
                Brush
              </button>
              <button
                type="button"
                className={`rounded-md border px-3 py-2 text-xs font-medium ${
                  state.session.brush.mode === "erase"
                    ? "border-red-500 bg-red-50 text-red-700"
                    : "border-gray-200 text-gray-700"
                }`}
                onClick={() => dispatch({ type: "SET_BRUSH_MODE", mode: "erase" })}
              >
                Eraser
              </button>
            </div>
            <label className="block text-xs font-medium text-gray-700">
              Size: {state.session.brush.sizePx}px
              <input
                className="mt-2 w-full"
                type="range"
                min="4"
                max="128"
                value={state.session.brush.sizePx}
                onChange={(event) => dispatch({ type: "SET_BRUSH_SIZE", size: Number(event.target.value) })}
              />
            </label>
            <label className="block text-xs font-medium text-gray-700">
              Opacity: {Math.round(state.session.brush.opacity * 100)}%
              <input
                className="mt-2 w-full"
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={state.session.brush.opacity}
                onChange={(event) => dispatch({ type: "SET_BRUSH_OPACITY", opacity: Number(event.target.value) })}
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className="rounded-md border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!hasImage}
                onClick={() => setShowMaskOverlay((visible) => !visible)}
              >
                {showMaskOverlay ? "Hide overlay" : "Show overlay"}
              </button>
              <button
                type="button"
                className="rounded-md border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!hasImage}
                onClick={resetMask}
              >
                Reset mask
              </button>
            </div>
          </section>

          <section className="space-y-2 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">Quality status</h2>
            <p className="rounded-md bg-blue-50 p-3 text-xs text-blue-700">
              Local browser processing: enabled. Photos are not uploaded.
            </p>
            <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-700">
              Browser QA blocked until Node 20.x LTS or Node 18.19+ is active.
            </p>
          </section>
        </aside>

        <div ref={workspaceRef} className="flex flex-1 items-center justify-center overflow-hidden bg-gray-50 p-6">
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
              showMaskOverlay={showMaskOverlay}
              onBrushStroke={applyBrushStroke}
            />
          ) : (
            <div className="max-w-sm rounded-lg border border-gray-200 bg-white px-8 py-10 text-center shadow-sm">
              <p className="text-sm font-semibold text-gray-900">Start with a room photo</p>
              <p className="mt-2 text-sm text-gray-600">
                Upload a JPG, PNG, or WebP. ChromaMatch decodes it locally in your browser; your photo is not uploaded.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
