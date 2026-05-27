import { useCallback, useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { ACCEPTED_IMAGE_TYPES, UNSUPPORTED_IMAGE_TYPE_MESSAGE } from "../hooks/useEditorSession";

interface ImageUploadProps {
  onFile: (file: File) => void | Promise<void>;
  hasImage: boolean;
  onClear: () => void;
  fileName?: string | null;
  isLoading?: boolean;
  error?: string | null;
}

export const ImageUpload = ({ onFile, hasImage, onClear, fileName, isLoading = false, error }: ImageUploadProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const visibleError = error ?? localError;

  const handleFile = useCallback(
    (file: File) => {
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
        setLocalError(UNSUPPORTED_IMAGE_TYPE_MESSAGE);
        return;
      }

      setLocalError(null);
      onFile(file);
      if (inputRef.current) inputRef.current.value = "";
    },
    [onFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  if (hasImage) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="block truncate text-sm font-medium text-gray-700">{fileName ?? "Image loaded"}</span>
            <span className="text-xs text-gray-500">Photo loaded. Working image prepared at up to 2048px on the longest side.</span>
          </div>
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear uploaded photo"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-xs text-blue-700">Photos stay in your browser and are not uploaded.</p>
      </div>
    );
  }

  return (
    <div>
      <label
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
          isDragging ? "border-blue-400 bg-blue-50" : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <Upload className="mb-2 h-8 w-8 text-gray-400" />
        <span className="text-sm font-medium text-gray-600">
          {isLoading ? "Decoding photo locally..." : "Upload room photo"}
        </span>
        <span className="mt-1 text-xs text-gray-400">JPG, PNG, or WebP - photos stay in your browser</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          disabled={isLoading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </label>
      {visibleError ? <p className="mt-2 text-xs text-red-600">{visibleError}</p> : null}
    </div>
  );
};
