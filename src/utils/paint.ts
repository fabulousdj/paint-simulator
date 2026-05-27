import type { PaintColor, RgbColor } from "../types/session";
import { computedLrvFromRgb, rgbFromHex, rgbToHex, rgbToLabD50 } from "./color";

export type PaintInput = {
  hex?: string;
  rgb?: {
    r?: string;
    g?: string;
    b?: string;
  };
  lrv?: string;
};

export type PaintFieldError = {
  field: "color" | "rgb" | "lrv";
  message: string;
};

export type PaintWarning = {
  field: "lrv";
  message: string;
};

export type PaintNormalizationResult =
  | {
      ok: true;
      paint: PaintColor;
      warnings: PaintWarning[];
      errors: [];
    }
  | {
      ok: false;
      paint: null;
      warnings: [];
      errors: PaintFieldError[];
    };

const HEX_PATTERN = /^#?[0-9a-fA-F]{6}$/;
const LRV_MISMATCH_MESSAGE =
  "RGB-derived LRV differs from manual LRV by more than 2. Check the paint data before continuing.";

function parseRgbChannel(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value.trim())) return null;

  const channel = Number(value);
  if (!Number.isInteger(channel) || channel < 0 || channel > 255) return null;
  return channel;
}

function parseRgb(rgb: PaintInput["rgb"]): RgbColor | null {
  if (!rgb) return null;

  const r = parseRgbChannel(rgb.r);
  const g = parseRgbChannel(rgb.g);
  const b = parseRgbChannel(rgb.b);
  if (r === null || g === null || b === null) return null;

  return { r, g, b };
}

function parseLrv(value: string | undefined): number | PaintFieldError {
  if (!value || value.trim() === "") {
    return { field: "lrv", message: "Enter the paint's LRV from 0 to 100." };
  }

  const lrv = Number(value);
  if (!Number.isFinite(lrv) || lrv < 0 || lrv > 100) {
    return { field: "lrv", message: "LRV must be a number from 0 to 100." };
  }

  return lrv;
}

export function normalizePaintInput(input: PaintInput): PaintNormalizationResult {
  const errors: PaintFieldError[] = [];
  const rawHex = input.hex?.trim() ?? "";
  const hasRgb = Boolean(input.rgb?.r || input.rgb?.g || input.rgb?.b);

  let rgb: RgbColor | null = null;

  if (rawHex) {
    if (!HEX_PATTERN.test(rawHex)) {
      errors.push({ field: "color", message: "Use a 6-digit Hex value like #D4D8D7." });
    } else {
      rgb = rgbFromHex(rawHex);
    }
  } else if (hasRgb) {
    rgb = parseRgb(input.rgb);
    if (!rgb) {
      errors.push({ field: "rgb", message: "RGB values must be whole numbers from 0 to 255." });
    }
  } else {
    errors.push({ field: "color", message: "Enter a Hex color or RGB values." });
  }

  const lrvResult = parseLrv(input.lrv);
  if (typeof lrvResult !== "number") {
    errors.push(lrvResult);
  }

  if (errors.length > 0 || !rgb || typeof lrvResult !== "number") {
    return { ok: false, paint: null, warnings: [], errors };
  }

  const computedLrv = computedLrvFromRgb(rgb);
  const lrvDelta = computedLrv - lrvResult;
  const paint: PaintColor = {
    rgb,
    hex: rgbToHex(rgb),
    lrv: lrvResult,
    labD50: rgbToLabD50(rgb),
    computedLrv,
    lrvDelta,
  };

  const warnings = Math.abs(lrvDelta) > 2
    ? [{ field: "lrv" as const, message: LRV_MISMATCH_MESSAGE }]
    : [];

  return { ok: true, paint, warnings, errors: [] };
}
