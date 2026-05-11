import type { RgbColor, LabColor } from "../types/session";

const D50_WHITE_X = 0.96422;
const D50_WHITE_Y = 1.0;
const D50_WHITE_Z = 0.82521;
const EPSILON = 216 / 24389;
const KAPPA = 24389 / 27;

export function linearizeChannel(ch: number): number {
  if (ch <= 0.04045) return ch / 12.92;
  return Math.pow((ch + 0.055) / 1.055, 2.4);
}

export function encodeChannel(linear: number): number {
  if (linear <= 0.0031308) return 12.92 * linear;
  return 1.055 * Math.pow(linear, 1 / 2.4) - 0.055;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function rgbToLinearRgb(rgb: RgbColor): { r: number; g: number; b: number } {
  return {
    r: linearizeChannel(rgb.r / 255),
    g: linearizeChannel(rgb.g / 255),
    b: linearizeChannel(rgb.b / 255),
  };
}

export function linearRgbToRgb(linear: { r: number; g: number; b: number }): RgbColor {
  return {
    r: clamp(Math.round(encodeChannel(linear.r) * 255), 0, 255),
    g: clamp(Math.round(encodeChannel(linear.g) * 255), 0, 255),
    b: clamp(Math.round(encodeChannel(linear.b) * 255), 0, 255),
  };
}

const X_R = 0.4360747;
const X_G = 0.3850649;
const X_B = 0.1430804;
const Y_R = 0.2225045;
const Y_G = 0.7168786;
const Y_B = 0.0606169;
const Z_R = 0.0139322;
const Z_G = 0.0971045;
const Z_B = 0.7141733;

export function linearToXyzD50(linear: { r: number; g: number; b: number }): { x: number; y: number; z: number } {
  return {
    x: linear.r * X_R + linear.g * X_G + linear.b * X_B,
    y: linear.r * Y_R + linear.g * Y_G + linear.b * Y_B,
    z: linear.r * Z_R + linear.g * Z_G + linear.b * Z_B,
  };
}

const IR_X = 3.1338561;
const IR_Y = -1.6168667;
const IR_Z = -0.4906146;
const IG_X = -0.9787684;
const IG_Y = 1.9161415;
const IG_Z = 0.033454;
const IB_X = 0.0719453;
const IB_Y = -0.2289914;
const IB_Z = 1.4052427;

export function xyzD50ToLinear(xyz: { x: number; y: number; z: number }): { r: number; g: number; b: number } {
  return {
    r: xyz.x * IR_X + xyz.y * IR_Y + xyz.z * IR_Z,
    g: xyz.x * IG_X + xyz.y * IG_Y + xyz.z * IG_Z,
    b: xyz.x * IB_X + xyz.y * IB_Y + xyz.z * IB_Z,
  };
}

function labF(t: number): number {
  if (t > EPSILON) return Math.cbrt(t);
  return (KAPPA * t + 16) / 116;
}

function labFInv(f: number): number {
  const fCubed = f * f * f;
  if (fCubed > EPSILON) return fCubed;
  return (116 * f - 16) / KAPPA;
}

export function xyzD50ToLab(xyz: { x: number; y: number; z: number }): LabColor {
  const fx = labF(xyz.x / D50_WHITE_X);
  const fy = labF(xyz.y / D50_WHITE_Y);
  const fz = labF(xyz.z / D50_WHITE_Z);

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

export function labToXyzD50(lab: LabColor): { x: number; y: number; z: number } {
  const fy = (lab.l + 16) / 116;
  const fx = lab.a / 500 + fy;
  const fz = fy - lab.b / 200;

  return {
    x: labFInv(fx) * D50_WHITE_X,
    y: labFInv(fy) * D50_WHITE_Y,
    z: labFInv(fz) * D50_WHITE_Z,
  };
}

export function rgbToLabD50(rgb: RgbColor): LabColor {
  const linear = rgbToLinearRgb(rgb);
  const xyz = linearToXyzD50(linear);
  return xyzD50ToLab(xyz);
}

export function labD50ToRgb(lab: LabColor): RgbColor {
  const lClamped = clamp(lab.l, 0, 100);
  const xyz = labToXyzD50({ ...lab, l: lClamped });
  const linear = xyzD50ToLinear(xyz);
  return linearRgbToRgb(linear);
}

export function labD50Delta(from: RgbColor, to: RgbColor): { dl: number; da: number; db: number } {
  const fromLab = rgbToLabD50(from);
  const toLab = rgbToLabD50(to);
  return {
    dl: toLab.l - fromLab.l,
    da: toLab.a - fromLab.a,
    db: toLab.b - fromLab.b,
  };
}

export function rgbFromHex(hex: string): RgbColor {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

export function rgbToHex(rgb: RgbColor): string {
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`.toLowerCase();
}

export function computedLrvFromRgb(rgb: RgbColor): number {
  const linear = rgbToLinearRgb(rgb);
  const xyz = linearToXyzD50(linear);
  return xyz.y * 100;
}

export function lrvToLabL(lrv: number): number {
  if (lrv > 0.008856 * 100) return 116 * Math.cbrt(lrv / 100) - 16;
  return 903.3 * (lrv / 100);
}

export function deltaE(lab1: LabColor, lab2: LabColor): number {
  const dl = lab1.l - lab2.l;
  const da = lab1.a - lab2.a;
  const db = lab1.b - lab2.b;
  return Math.sqrt(dl * dl + da * da + db * db);
}

export function clampRgb(x: number): number {
  return clamp(Math.round(x), 0, 255);
}
