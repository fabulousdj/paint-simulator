import { PaintBucket } from "lucide-react";
import { useCallback, useRef } from "react";
import { FixturePanel } from "./components/FixturePanel";
import { ImageUpload } from "./components/ImageUpload";
import { PaintInput } from "./components/PaintInput";
import { useEditorSession } from "./hooks/useEditorSession";
import type { PaintColor } from "./types/session";

function App() {
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const { state, dispatch, canvasRef, loadImageFile, upload } = useEditorSession(workspaceRef);
  const hasImage = state.session.image.sourceImageData !== null;

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
            <canvas
              ref={canvasRef}
              aria-label="Uploaded room photo canvas"
              className="max-h-full max-w-full rounded-lg border border-gray-200 bg-white shadow-sm"
              style={{
                width: state.session.image.displayWidth || undefined,
                height: state.session.image.displayHeight || undefined,
              }}
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
