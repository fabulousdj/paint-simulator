import { describe, expect, it } from "vitest";
import { roomSamples } from "../fixtures/roomSamples";

describe("roomSamples", () => {
  it("has unique IDs", () => {
    const ids = roomSamples.map((sample) => sample.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers bright, shadowed, and mixed or textured lighting categories", () => {
    const categories = new Set(roomSamples.map((sample) => sample.lightingCategory));

    expect(categories.has("bright")).toBe(true);
    expect(categories.has("shadowed")).toBe(true);
    expect(categories.has("mixed-lighting") || categories.has("textured")).toBe(true);
  });

  it("requires availability and usage/license notes", () => {
    for (const sample of roomSamples) {
      expect(sample.availability).toBeTruthy();
      expect(sample.usageNotes.trim().length).toBeGreaterThan(0);
      expect(sample.licenseNotes.trim().length).toBeGreaterThan(0);
    }
  });

  it("labels placeholder entries honestly", () => {
    const placeholders = roomSamples.filter((sample) => sample.availability === "metadata-placeholder");

    expect(placeholders.length).toBeGreaterThan(0);
    for (const sample of placeholders) {
      expect(`${sample.usageNotes} ${sample.licenseNotes}`).toContain("Metadata placeholder");
      expect(sample.licenseNotes).toContain("no licensed photo is bundled");
    }
  });
});
