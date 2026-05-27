import { useEffect, useId, useMemo, useState } from "react";
import type { PaintColor } from "../types/session";
import { normalizePaintInput } from "../utils/paint";

type PaintInputProps = {
  title: string;
  description: string;
  onPaintChange: (paint: PaintColor | null) => void;
};

type InputMode = "hex" | "rgb";

export function PaintInput({ title, description, onPaintChange }: PaintInputProps) {
  const id = useId();
  const [mode, setMode] = useState<InputMode>("hex");
  const [hex, setHex] = useState("");
  const [r, setR] = useState("");
  const [g, setG] = useState("");
  const [b, setB] = useState("");
  const [lrv, setLrv] = useState("");

  const result = useMemo(
    () => normalizePaintInput(
      mode === "hex"
        ? { hex, lrv }
        : { rgb: { r, g, b }, lrv }
    ),
    [b, g, hex, lrv, mode, r]
  );
  const colorError = !result.ok
    ? result.errors.find((error) => error.field === "color" || error.field === "rgb")
    : undefined;
  const lrvError = !result.ok
    ? result.errors.find((error) => error.field === "lrv")
    : undefined;
  const lrvWarning = result.ok ? result.warnings[0] : undefined;
  const paint = result.ok ? result.paint : null;

  useEffect(() => {
    onPaintChange(paint);
  }, [onPaintChange, paint]);

  const colorMessageId = `${id}-color-message`;
  const lrvMessageId = `${id}-lrv-message`;

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          <p className="mt-1 text-xs text-gray-500">{description}</p>
        </div>
        {paint ? (
          <span
            className="h-9 w-9 shrink-0 rounded-md border border-gray-200"
            style={{ backgroundColor: paint.hex }}
            aria-label={`Color preview ${paint.hex}`}
            role="img"
          />
        ) : null}
      </div>

      <fieldset className="mt-3">
        <legend className="text-xs font-medium text-gray-700">Color format</legend>
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
          <label className="flex min-h-11 items-center gap-2 rounded-md border border-gray-200 px-3 text-gray-700">
            <input
              type="radio"
              name={`${id}-mode`}
              value="hex"
              checked={mode === "hex"}
              onChange={() => setMode("hex")}
              className="h-4 w-4 text-blue-500 focus:ring-blue-500"
            />
            Hex
          </label>
          <label className="flex min-h-11 items-center gap-2 rounded-md border border-gray-200 px-3 text-gray-700">
            <input
              type="radio"
              name={`${id}-mode`}
              value="rgb"
              checked={mode === "rgb"}
              onChange={() => setMode("rgb")}
              className="h-4 w-4 text-blue-500 focus:ring-blue-500"
            />
            RGB
          </label>
        </div>
      </fieldset>

      {mode === "hex" ? (
        <div className="mt-3">
          <label htmlFor={`${id}-hex`} className="text-sm font-medium text-gray-700">
            Hex color
          </label>
          <input
            id={`${id}-hex`}
            value={hex}
            onChange={(event) => setHex(event.target.value)}
            placeholder="#D4D8D7"
            aria-invalid={Boolean(colorError)}
            aria-describedby={colorMessageId}
            className="mt-1 min-h-11 w-full rounded-md border border-gray-300 px-3 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </div>
      ) : (
        <div className="mt-3">
          <span className="text-sm font-medium text-gray-700">RGB color</span>
          <div className="mt-1 grid grid-cols-3 gap-2">
            <input
              aria-label="Red channel"
              value={r}
              onChange={(event) => setR(event.target.value)}
              placeholder="R"
              inputMode="numeric"
              aria-invalid={Boolean(colorError)}
              aria-describedby={colorMessageId}
              className="min-h-11 rounded-md border border-gray-300 px-3 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
            <input
              aria-label="Green channel"
              value={g}
              onChange={(event) => setG(event.target.value)}
              placeholder="G"
              inputMode="numeric"
              aria-invalid={Boolean(colorError)}
              aria-describedby={colorMessageId}
              className="min-h-11 rounded-md border border-gray-300 px-3 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
            <input
              aria-label="Blue channel"
              value={b}
              onChange={(event) => setB(event.target.value)}
              placeholder="B"
              inputMode="numeric"
              aria-invalid={Boolean(colorError)}
              aria-describedby={colorMessageId}
              className="min-h-11 rounded-md border border-gray-300 px-3 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>
        </div>
      )}

      <p id={colorMessageId} className={`mt-1 text-xs ${colorError ? "text-red-600" : "text-gray-500"}`}>
        {colorError?.message ?? "Enter a 6-digit Hex value or RGB values from 0 to 255."}
      </p>

      <div className="mt-3">
        <label htmlFor={`${id}-lrv`} className="text-sm font-medium text-gray-700">
          Manual LRV
        </label>
        <input
          id={`${id}-lrv`}
          value={lrv}
          onChange={(event) => setLrv(event.target.value)}
          placeholder="0-100"
          inputMode="decimal"
          aria-invalid={Boolean(lrvError)}
          aria-describedby={lrvMessageId}
          className="mt-1 min-h-11 w-full rounded-md border border-gray-300 px-3 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
        />
        <p id={lrvMessageId} className={`mt-1 text-xs ${lrvError ? "text-red-600" : "text-gray-500"}`}>
          {lrvError?.message ?? "Required paint LRV from 0 to 100."}
        </p>
      </div>

      {paint ? (
        <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
          <p>Computed LRV: {paint.computedLrv.toFixed(1)}</p>
          <p>Manual LRV: {paint.lrv.toFixed(1)}</p>
          <p>LRV delta: {paint.lrvDelta >= 0 ? "+" : ""}{paint.lrvDelta.toFixed(1)}</p>
          <p className="mt-2 font-medium text-blue-700">Paint value normalized and ready.</p>
        </div>
      ) : null}

      {lrvWarning ? (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
          {lrvWarning.message}
        </p>
      ) : null}
    </section>
  );
}
