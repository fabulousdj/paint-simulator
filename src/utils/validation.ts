import type { SimulationMetadata } from "./simulation";
import { simulatePaintTransfer } from "./simulation";
import { deltaE, rgbToLabD50 } from "./color";
import type { ValidationFixture, ValidationRegion } from "../fixtures/validationFixtures";
import type { SimulationMode } from "../types/session";

export type RegionDeltaSummary = {
  regionId: string;
  label: string;
  averageDeltaE: number;
  maxDeltaE: number;
  sampledPixelCount: number;
};

export type ModeValidationSummary = {
  mode: SimulationMode;
  metadata: SimulationMetadata;
  sourceToResult: RegionDeltaSummary[];
  checksum: number;
};

export type FixtureValidationReport = {
  fixtureId: string;
  name: string;
  lightingCondition: ValidationFixture["lightingCondition"];
  transition: string;
  lab: ModeValidationSummary;
  rgbRatioDebug: ModeValidationSummary;
  labVsRgbRatioDebug: RegionDeltaSummary[];
};

export function createFixtureImageData(fixture: ValidationFixture): ImageData {
  return new ImageData(new Uint8ClampedArray(fixture.pixels), fixture.width, fixture.height);
}

function pixelRgb(data: Uint8ClampedArray, pixelIndex: number) {
  const sourceIndex = pixelIndex * 4;

  return {
    r: data[sourceIndex] ?? 0,
    g: data[sourceIndex + 1] ?? 0,
    b: data[sourceIndex + 2] ?? 0,
  };
}

function summarizeRegionDelta(
  source: ImageData,
  result: ImageData,
  region: ValidationRegion,
): RegionDeltaSummary {
  let total = 0;
  let max = 0;

  for (const pixelIndex of region.pixelIndexes) {
    const sourceLab = rgbToLabD50(pixelRgb(source.data, pixelIndex));
    const resultLab = rgbToLabD50(pixelRgb(result.data, pixelIndex));
    const dE = deltaE(sourceLab, resultLab);
    total += dE;
    max = Math.max(max, dE);
  }

  const sampledPixelCount = region.pixelIndexes.length;

  return {
    regionId: region.id,
    label: region.label,
    averageDeltaE: sampledPixelCount === 0 ? 0 : total / sampledPixelCount,
    maxDeltaE: max,
    sampledPixelCount,
  };
}

function imageChecksum(imageData: ImageData): number {
  let checksum = 0;

  for (let index = 0; index < imageData.data.length; index += 1) {
    checksum = (checksum + (imageData.data[index] ?? 0) * (index + 1)) % 1_000_000_007;
  }

  return checksum;
}

function summarizeMode(fixture: ValidationFixture, mode: SimulationMode): ModeValidationSummary {
  const source = createFixtureImageData(fixture);
  const result = simulatePaintTransfer({
    sourceImageData: source,
    mask: new Uint8ClampedArray(fixture.mask),
    paintA: fixture.paintA,
    paintB: fixture.paintB,
    mode,
  });

  return {
    mode,
    metadata: result.metadata,
    sourceToResult: fixture.regions.map((region) => summarizeRegionDelta(source, result.imageData, region)),
    checksum: imageChecksum(result.imageData),
  };
}

export function compareImagesByRegion(
  first: ImageData,
  second: ImageData,
  regions: ValidationRegion[],
): RegionDeltaSummary[] {
  return regions.map((region) => summarizeRegionDelta(first, second, region));
}

export function buildFixtureValidationReport(fixture: ValidationFixture): FixtureValidationReport {
  const lab = summarizeMode(fixture, "lab-delta-d50");
  const rgbRatioDebug = summarizeMode(fixture, "rgb-ratio-debug");
  const source = createFixtureImageData(fixture);
  const labImage = simulatePaintTransfer({
    sourceImageData: source,
    mask: new Uint8ClampedArray(fixture.mask),
    paintA: fixture.paintA,
    paintB: fixture.paintB,
    mode: "lab-delta-d50",
  }).imageData;
  const rgbImage = simulatePaintTransfer({
    sourceImageData: createFixtureImageData(fixture),
    mask: new Uint8ClampedArray(fixture.mask),
    paintA: fixture.paintA,
    paintB: fixture.paintB,
    mode: "rgb-ratio-debug",
  }).imageData;

  return {
    fixtureId: fixture.id,
    name: fixture.name,
    lightingCondition: fixture.lightingCondition,
    transition: fixture.transition,
    lab,
    rgbRatioDebug,
    labVsRgbRatioDebug: compareImagesByRegion(labImage, rgbImage, fixture.regions),
  };
}

export function buildValidationReports(fixtures: ValidationFixture[]): FixtureValidationReport[] {
  return fixtures.map(buildFixtureValidationReport);
}
