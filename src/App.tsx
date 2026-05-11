import { PaintBucket } from "lucide-react";

function App() {
  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-6 py-4">
        <PaintBucket className="h-6 w-6 text-blue-500" />
        <h1 className="text-lg font-semibold tracking-tight">ChromaMatch</h1>
        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
          MVP
        </span>
      </header>

      {/* Editor Shell */}
      <main className="flex flex-1 overflow-hidden">
        {/* Sidebar - future paint inputs */}
        <aside className="w-72 border-r border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">
            Paint inputs and controls will appear here.
          </p>
        </aside>

        {/* Canvas area - future image display */}
        <div className="flex flex-1 items-center justify-center bg-gray-50">
          <div className="text-center text-sm text-gray-400">
            <p>Upload a room photo to get started.</p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
