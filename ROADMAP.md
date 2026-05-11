# ChromaMatch Roadmap

Source docs: `PRD.md`, `TDD.md`

## Product Goal

Build ChromaMatch, a cross-brand, photo-realistic wall paint simulator that uses a user's current wall paint color as a lighting reference. The MVP should let a user upload a room photo, manually enter Paint A, manually mask a wall, enter Paint B, visualize a realistic LAB D50 simulation, and export the result without uploading the image to a backend.

## Technical Strategy

The roadmap follows the TDD's fidelity-first, local-first plan:

- Ship a browser-based MVP using Vite, React, TypeScript, Tailwind CSS, Canvas 2D, Web Workers, Vitest, and Playwright.
- Keep image processing local in the browser for the MVP.
- Make LAB D50 delta transfer the default simulation engine.
- Require manual RGB/Hex and LRV for Paint A and Paint B in the MVP.
- Treat LRV as validation-only until real validation images prove an override improves fidelity.
- Keep RGB ratio as an optional debug/reference mode, not a product algorithm.
- Keep manual masking as the durable fallback before and after SAM-assisted segmentation.
- Export from a bounded high-quality working image first, with full-resolution export deferred until the fidelity loop is proven.

## Phase 0: Foundation and Color Core

**Objective:** Establish the app skeleton, local image pipeline, and deterministic color-science utilities before building the full editor.

**Deliverables:**

- Vite + React + TypeScript app shell.
- Tailwind CSS, shadcn/Radix-style UI primitives, and lucide-react setup.
- Image upload flow with Canvas 2D display.
- Explicit display-to-working-image coordinate mapping.
- Working image pipeline with a max dimension around `2048px`.
- Manual RGB/Hex + LRV input model for Paint A and Paint B.
- Color utility test harness in Vitest.
- Representative sample image set:
  - One bright room.
  - One shadowed room.
  - One textured wall or mixed-lighting scene.

**Acceptance Criteria:**

- A user can load and view a room photo in the browser.
- The app can decode image pixels into an `ImageData` or typed-array workflow.
- RGB/Hex and LRV normalize into the TDD `PaintColor` model.
- D50 color utility tests cover black, white, neutral gray, RGB primaries, and the TDD paint fixtures.
- The app warns when `abs(computedLrv - manualLrv) > 2`.
- Uploaded photos remain local to the browser.

**Key Risks:**

- Coordinate mapping errors can make masking feel inaccurate.
- Early canvas sizing choices can constrain export quality or performance.
- Bad sample photos can hide fidelity problems.

## Phase 1: Fidelity-First MVP

**Objective:** Prove the complete manual workflow with the LAB D50 delta-transfer engine as the default renderer.

### Milestone 1.1: Manual Mask Editor

**Deliverables:**

- Brush paint tool.
- Eraser tool.
- Brush size and opacity controls.
- Mask overlay toggle.
- Clear/reset mask action.
- Alpha mask buffer where `0` is unchanged and `255` is fully simulated.
- Cursor/brush preview that does not mutate the mask until drawing begins.

**Acceptance Criteria:**

- A user can manually isolate a wall area in under 30 seconds on a typical room photo.
- Brush and eraser strokes feel immediate on desktop-size images.
- Mask edits update the mask buffer, not the original image.
- The simulation affects masked pixels only.

### Milestone 1.2: LAB D50 Simulation Engine

**Deliverables:**

- Pure simulation utilities isolated from UI code.
- Web Worker boundary for full-image transforms.
- sRGB -> linear RGB -> XYZ D50 -> LAB D50 conversion.
- LAB D50 -> XYZ D50 -> linear RGB -> sRGB conversion.
- Paint A/Paint B LAB delta calculation.
- Per-pixel LAB delta transfer for masked pixels.
- Mask-alpha blending with original pixels.
- LAB `L*` and RGB clamping.
- Out-of-gamut clipping tracking for debugging.
- Optional `rgb-ratio-debug` engine behind a developer/debug mode.

**Acceptance Criteria:**

- Paint B renders on the masked wall using Paint A calibration in LAB D50 space.
- Original shadows, highlights, and texture remain visible.
- Unmasked areas remain unchanged.
- Paint B changes re-render within roughly 100-300 ms for typical working images.
- RGB ratio is available only as a comparison/debug path.

### Milestone 1.3: MVP Workflow and Export

**Deliverables:**

- Guided flow: upload, define Paint A, mask, define Paint B, visualize, export.
- Validation gates for missing image, invalid paint inputs, and empty mask.
- Before/after toggle or comparison view.
- Export/download without mask overlay or cursor.
- Basic Playwright coverage for the full browser workflow.

**Acceptance Criteria:**

- A first-time user can complete the MVP flow without developer assistance.
- Export composites original pixels where the mask is empty and simulated pixels where the mask is active.
- MVP can be demoed end to end from a blank app state.

## Phase 2: Fidelity Validation and Tuning

**Objective:** Use repeatable fixtures and real-world references to decide whether the default LAB pipeline needs tuning.

### Milestone 2.1: Deterministic Validation

**Deliverables:**

- Unit tests for Hex/RGB parsing.
- Round-trip RGB -> LAB D50 -> RGB tolerance tests.
- LRV consistency tests.
- Delta-E comparison utility.
- Mask alpha blending tests.
- Out-of-gamut and clipping tests.
- Fixtures from the TDD, including:
  - `#D4D8D7`, RGB `212/216/215`, LRV `68`.
  - `#CDBFB0`, RGB `205/191/176`, LRV `53`.
  - `#C9CCCD`, RGB `201/204/205`, LRV `60`.

**Acceptance Criteria:**

- Conversion utilities match expected LAB fixture values within agreed tolerance.
- The Paint A -> Paint B theoretical deltas from the TDD are covered by tests.
- Delta-E can be calculated for selected wall regions.

### Milestone 2.2: Visual Regression

**Deliverables:**

- Approved before/after snapshots for representative room photos.
- Side-by-side comparison of LAB default vs RGB debug mode.
- Selected-region Delta-E measurement workflow.
- Failure notes grouped by lighting condition and color transition.

**Acceptance Criteria:**

- LAB simulation avoids visibly muddy dark tones compared with RGB ratio mode.
- Shadow depth is preserved for light-to-dark and dark-to-light transitions.
- Regressions are visible through snapshots before they reach the demo path.

### Milestone 2.3: Algorithm Tuning Decisions

**Deliverables:**

- Experiments for optional LRV-derived `L*` override.
- Experiments for perceptual chroma compression if simple clipping creates artifacts.
- Documentation of known limitations around camera white balance, surface finish, and paint sample cards.
- Decision record for whether any tuning enters the default MVP pipeline.

**Acceptance Criteria:**

- LRV remains validation-only unless validation data shows a clear fidelity gain.
- Any promoted tuning has before/after evidence and test coverage.
- Known fidelity limitations are documented for beta users and future contributors.

## Phase 3: UX Automation

**Objective:** Reduce masking effort with automatic wall segmentation while preserving manual correction.

### Milestone 3.1: Segmentation Boundary

**Deliverables:**

- Segmentation provider interface independent of manual mask editing.
- Decision on SAM approach: client-side, server-side, or hosted inference.
- Model loading, caching, latency, and cost plan.
- Privacy policy for any flow where photos leave the browser.

**Acceptance Criteria:**

- The integration choice is documented with cost, latency, quality, and privacy tradeoffs.
- Manual masking remains available as the fallback path.
- Server/backend work is introduced only if segmentation or future product needs require it.

### Milestone 3.2: One-Tap Wall Selection

**Deliverables:**

- Wall-region selection interaction.
- SAM-generated mask preview.
- Accept, refine, and reset controls.
- Manual brush refinement on generated masks.
- Basic edge smoothing or feathering.

**Acceptance Criteria:**

- A user can create a usable wall mask in under 5 seconds on common room photos.
- Auto masks can be corrected without restarting the workflow.
- Edge quality is good enough for realistic visualization.

### Milestone 3.3: Automation Quality Pass

**Deliverables:**

- Segmentation failure states.
- Mask quality review set.
- Masking analytics:
  - Time to first usable mask.
  - Accept/reject rate.
  - Number of manual corrections.

**Acceptance Criteria:**

- Auto-masking improves average task time without reducing output quality.
- Failure cases recover cleanly through manual tools.

## Phase 4: Paint Catalog and Cross-Brand Comparison

**Objective:** Move from manual paint entry toward the cross-brand comparison experience promised in the PRD.

**Deliverables:**

- Paint catalog schema matching the TDD `PaintCatalogEntry`.
- Seed catalog for representative colors across brands.
- Search and filter UI.
- Recently used colors.
- Multi-color Paint B comparison on the same wall.
- Manual Hex/RGB + LRV entry retained as a fallback.

**Acceptance Criteria:**

- Users can compare colors from more than one brand in the same workflow.
- Catalog colors include RGB/Hex and use LRV when available.
- Manual entry remains fully supported.

## Phase 5: Beta Readiness

**Objective:** Prepare ChromaMatch for private beta feedback and measurable product validation.

**Deliverables:**

- Cross-browser QA across common desktop and mobile browsers.
- Performance budget for upload, masking, simulation, and export.
- Empty states and onboarding for the editor flow.
- Privacy and data-handling copy for uploaded photos.
- Feedback capture mechanism.
- Event logging plan that avoids image content and raw photo data.
- KPI reporting for:
  - Image loaded.
  - Mask started.
  - Mask completed.
  - Time to first usable mask.
  - Simulation rendered.
  - Result exported.
  - Number of target colors previewed.
  - Simulation mode selected.

**Acceptance Criteria:**

- The app is stable enough for a small private beta.
- PRD KPIs can be measured.
- Users can save more than 3 simulations in a session.
- Privacy expectations are clear before any non-local processing is introduced.

## MVP Definition

The MVP is complete when a user can:

1. Upload a room photo.
2. Enter the current wall color's RGB/Hex and LRV.
3. Mask a wall manually with brush and eraser tools.
4. Enter a target paint color's RGB/Hex and LRV.
5. View a believable LAB D50 simulation that preserves lighting and texture.
6. Compare before/after.
7. Export the result locally.

## Recommended Build Order

1. Scaffold Vite + React + TypeScript app with styling and UI primitives.
2. Implement manual RGB/Hex + LRV parsing, normalization, and validation.
3. Implement D50 sRGB/XYZ/LAB conversion utilities with fixture tests.
4. Implement image upload and source canvas rendering.
5. Implement explicit display-to-working-image coordinate mapping.
6. Implement mask buffer and brush/eraser drawing.
7. Implement LAB D50 delta transfer engine and tests.
8. Move full-image simulation behind a Web Worker.
9. Wire preview, validation gates, and before/after comparison.
10. Add bounded high-quality export.
11. Add visual regression samples and Delta-E validation tooling.
12. Run LRV override and gamut-compression experiments only after validation data exists.
13. Prototype SAM-assisted masking behind a segmentation provider boundary.
14. Add paint catalog and cross-brand comparison.
15. Add beta instrumentation, QA, and privacy copy.

## Suggested Solo-Dev Timeline

| Timebox | Focus | Outcome |
| --- | --- | --- |
| Week 1 | Phase 0 | App scaffold, image upload, color input, D50 utility tests, sample images |
| Weeks 2-3 | Phase 1.1-1.2 | Manual masking and LAB D50 simulation in the browser |
| Week 4 | Phase 1.3 | Guided MVP workflow, before/after, export, Playwright smoke coverage |
| Weeks 5-6 | Phase 2.1-2.2 | Delta-E tooling, fixture validation, visual regression set |
| Week 7 | Phase 2.3 | LRV and gamut tuning decisions backed by validation evidence |
| Weeks 8-9 | Phase 3 | SAM-assisted masking prototype with manual refinement |
| Week 10 | Phase 4 | Small cross-brand paint catalog and comparison workflow |
| Week 11 | Phase 5 | Private beta polish, instrumentation, privacy copy, QA |

## Validation Plan

Use three validation layers:

- **Technical:** Vitest coverage for D50 color conversion, LAB delta transforms, LRV checks, mask alpha blending, clamping, and out-of-gamut handling.
- **Visual:** Approved sample photos with before/after snapshots for regression, not absolute color truth.
- **Real-world fidelity:** Same-wall or same-surface paint references measured with selected-region Delta-E where available.
- **User:** Time-to-mask, number of target colors previewed, exports, and saved simulations during beta.

## Open Decisions

1. Which 3-5 room photos and same-surface paint references should become the first fidelity regression set?
2. What tolerance should fixture tests use for LAB D50 conversion and RGB round trips?
3. Does validation data justify LRV-derived `L*` override, or should LRV remain validation-only?
4. Does simple clipping create enough artifacts to require perceptual chroma compression?
5. Should SAM run client-side, server-side, or through hosted inference?
6. Which paint brands and metadata sources are acceptable for the first catalog?
7. Should beta saves remain local-only, or should account/project storage enter the roadmap?
