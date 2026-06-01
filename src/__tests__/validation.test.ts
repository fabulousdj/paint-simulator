import { describe, expect, it } from "vitest";
import { validationFixtures } from "../fixtures/validationFixtures";
import {
  buildFixtureValidationReport,
  buildValidationReports,
  compareImagesByRegion,
  createFixtureImageData,
} from "../utils/validation";

class TestImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;

  constructor(data: Uint8ClampedArray, width: number, height?: number) {
    this.data = data;
    this.width = width;
    this.height = height ?? data.length / 4 / width;
  }
}

globalThis.ImageData ??= TestImageData as unknown as typeof ImageData;

function fixtureAt(index: number) {
  const fixture = validationFixtures[index];
  if (!fixture) throw new Error(`Missing validation fixture at index ${index}`);
  return fixture;
}

function rounded(value: number): number {
  return Math.round(value * 100) / 100;
}

function stableReport() {
  return buildValidationReports(validationFixtures).map((report) => ({
    fixtureId: report.fixtureId,
    labChecksum: report.lab.checksum,
    rgbRatioDebugChecksum: report.rgbRatioDebug.checksum,
    labAffectedPixels: report.lab.metadata.affectedPixelCount,
    labClippedPixels: report.lab.metadata.clippedPixelCount,
    labVsRgbRatioDebug: report.labVsRgbRatioDebug.map((region) => ({
      regionId: region.regionId,
      averageDeltaE: rounded(region.averageDeltaE),
      maxDeltaE: rounded(region.maxDeltaE),
    })),
    labSourceToResult: report.lab.sourceToResult.map((region) => ({
      regionId: region.regionId,
      averageDeltaE: rounded(region.averageDeltaE),
      maxDeltaE: rounded(region.maxDeltaE),
    })),
  }));
}

describe("validation workflow", () => {
  it("builds reports for all deterministic fixtures", () => {
    const reports = buildValidationReports(validationFixtures);

    expect(reports).toHaveLength(2);
    expect(reports.map((report) => report.fixtureId)).toEqual([
      "bright-neutral-to-cool-gray",
      "shadowed-neutral-to-warm-beige",
    ]);
  });

  it("summarizes selected-region Delta-E for LAB and RGB debug outputs", () => {
    const report = buildFixtureValidationReport(fixtureAt(0));

    expect(report.lab.mode).toBe("lab-delta-d50");
    expect(report.rgbRatioDebug.mode).toBe("rgb-ratio-debug");
    expect(report.lab.sourceToResult[0]?.averageDeltaE).toBeGreaterThan(0);
    expect(report.rgbRatioDebug.sourceToResult[0]?.averageDeltaE).toBeGreaterThan(0);
    expect(report.labVsRgbRatioDebug[0]?.averageDeltaE).toBeGreaterThan(0);
  });

  it("keeps unmasked pixels in the validation checksum", () => {
    const report = buildFixtureValidationReport(fixtureAt(0));

    expect(report.lab.metadata.affectedPixelCount).toBe(4);
    expect(report.rgbRatioDebug.metadata.affectedPixelCount).toBe(4);
    expect(report.lab.checksum).not.toBe(report.rgbRatioDebug.checksum);
  });

  it("detects identical images as zero selected-region Delta-E", () => {
    const fixture = fixtureAt(0);
    const image = createFixtureImageData(fixture);
    const regions = compareImagesByRegion(image, image, fixture.regions);

    expect(regions.every((region) => region.averageDeltaE === 0)).toBe(true);
    expect(regions.every((region) => region.maxDeltaE === 0)).toBe(true);
  });

  it("matches approved regression baselines", () => {
    expect(stableReport()).toMatchInlineSnapshot(`
      [
        {
          "fixtureId": "bright-neutral-to-cool-gray",
          "labAffectedPixels": 4,
          "labChecksum": 61165,
          "labClippedPixels": 0,
          "labSourceToResult": [
            {
              "averageDeltaE": 4.29,
              "maxDeltaE": 4.31,
              "regionId": "lit-wall",
            },
            {
              "averageDeltaE": 4.37,
              "maxDeltaE": 4.4,
              "regionId": "shadow-wall",
            },
          ],
          "labVsRgbRatioDebug": [
            {
              "averageDeltaE": 0.19,
              "maxDeltaE": 0.38,
              "regionId": "lit-wall",
            },
            {
              "averageDeltaE": 0.5,
              "maxDeltaE": 0.62,
              "regionId": "shadow-wall",
            },
          ],
          "rgbRatioDebugChecksum": 61225,
        },
        {
          "fixtureId": "shadowed-neutral-to-warm-beige",
          "labAffectedPixels": 5,
          "labChecksum": 44237,
          "labClippedPixels": 0,
          "labSourceToResult": [
            {
              "averageDeltaE": 13.21,
              "maxDeltaE": 13.24,
              "regionId": "deep-shadow",
            },
            {
              "averageDeltaE": 12.99,
              "maxDeltaE": 13.02,
              "regionId": "mid-wall",
            },
          ],
          "labVsRgbRatioDebug": [
            {
              "averageDeltaE": 5.94,
              "maxDeltaE": 6.94,
              "regionId": "deep-shadow",
            },
            {
              "averageDeltaE": 2.95,
              "maxDeltaE": 4.03,
              "regionId": "mid-wall",
            },
          ],
          "rgbRatioDebugChecksum": 45370,
        },
      ]
    `);
  });
});
