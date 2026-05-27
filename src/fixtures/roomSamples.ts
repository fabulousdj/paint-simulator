import type { PaintColor } from "../types/session";

export type LightingCategory = "bright" | "shadowed" | "textured" | "mixed-lighting";
export type SampleAvailability = "metadata-placeholder" | "bundled-photo";

export type RoomSample = {
  id: string;
  name: string;
  lightingCategory: LightingCategory;
  availability: SampleAvailability;
  usageNotes: string;
  licenseNotes: string;
  paintA?: PaintColor;
  paintB?: PaintColor;
};

export const roomSamples: RoomSample[] = [
  {
    id: "bright-neutral-room",
    name: "Bright neutral room",
    lightingCategory: "bright",
    availability: "metadata-placeholder",
    usageNotes: "Metadata placeholder for a well-lit wall with even daylight exposure.",
    licenseNotes: "Metadata placeholder only; no licensed photo is bundled in Phase 0.",
  },
  {
    id: "shadowed-corner-room",
    name: "Shadowed corner room",
    lightingCategory: "shadowed",
    availability: "metadata-placeholder",
    usageNotes: "Metadata placeholder for a room photo with visible wall shadows and falloff.",
    licenseNotes: "Metadata placeholder only; no licensed photo is bundled in Phase 0.",
  },
  {
    id: "mixed-light-textured-wall",
    name: "Textured or mixed-lighting wall",
    lightingCategory: "mixed-lighting",
    availability: "metadata-placeholder",
    usageNotes: "Metadata placeholder for mixed lighting or subtle wall texture validation.",
    licenseNotes: "Metadata placeholder only; no licensed photo is bundled in Phase 0.",
  },
];
