# PRD

# PRD: ChromaMatch — Real-World Paint Simulator

**Version:**  1.1

**Status:**  Draft / Active

**Author:**  Product Lead

**Context:**  1-Person Project (Solo Dev/Founder)

---

## 1. Executive Summary & Vision

**ChromaMatch** is a cross-brand, photo-realistic wall paint visualization tool. Unlike existing brand-locked apps that look "flat" or "cartoonish," ChromaMatch uses a user’s existing wall as a lighting reference. By knowing the current paint color (Paint A), the app calculates the unique lighting and texture characteristics of a room to perfectly simulate a new color (Paint B).

### The Problem

* **Brand Lock-in:**  Users can't compare a Behr color next to a Sherwin-Williams color in the same app.
* **Unrealistic Simulation:**  Most apps ignore shadows, light temperature, and texture, making the result look fake.
* **Physical Sample Limitations:**  4x4 samples are too small to gauge the "vibe" of an entire room.

---

## 2. Target Audience

* **DIY Home Owners:**  Looking to repaint but paralyzed by choice.
* **Interior Designers:**  Need a quick, high-fidelity way to show clients how a specific shade will interact with their unique lighting.

---

## 3. Core Functional Requirements

### 3.1 Lighting Calibration (The "Special Sauce")

* **Input Current State:**  User must enter the known attributes (RGB/Hex and LRV) of their current wall paint ("Paint A").
* **Calculate LAB Transfer Delta:**  The system will compare Paint A and Paint B in LAB D50 space, then apply that theoretical color delta to the photo's observed wall pixels.

### 3.2 Wall Masking & Segmentation

* **Manual Masking (v1):**  Users must be able to paint and correct the area they want to simulate using brush and eraser tools.
* **Auto-Segmentation (v2):**  Integration of Segment Anything Model (SAM) to automatically detect wall boundaries.

### 3.3 Simulation Engine

* **Color Conversion:**  Utility to convert user-provided RGB/Hex values into LAB D50 color space for perceptual accuracy.
* **LRV Validation:**  Use LRV (Light Reflectance Value) to validate whether RGB/Hex inputs are physically plausible. LRV should remain validation-only in the MVP, with L\* tuning deferred until validation data proves it improves fidelity.

---

## 4. Technical Specifications

### 4.1 The Algorithm

The core engine must implement the following logic:

1. **D50 Conversion:**  Convert observed pixels, Paint A, and Paint B from sRGB into LAB D50.
2. **Delta Calculation:**  `delta_lab = paint_B_lab_d50 - paint_A_lab_d50`.
3. **Simulated Output:**  `simulated_pixel_lab = observed_pixel_lab + delta_lab`.
4. **Display Conversion:**  Convert simulated LAB D50 back to sRGB for preview/export.

### 4.2 Precision Handling

* **Color Space:**  Perform math in **CIELAB** rather than RGB to avoid "muddy" or unrealistic color shifts in shadows.
* **Conversion Pipeline:**  sRGB → linear RGB → XYZ D50 → LAB D50.

---

## 5. User Journey (MVP)

1. **Upload:**  User uploads a high-quality photo of their room.
2. **Define Paint A:**  User enters current paint RGB/Hex and LRV.
3. **Mask:**  User highlights the wall area using a brush tool.
4. **Select Paint B:**  User enters target paint RGB/Hex and LRV.
5. **Visualize:**  The app renders the simulation instantly.

---

## 6. Project Roadmap

The roadmap follows the TDD's fidelity-first, local-first plan. The MVP should prove the manual LAB D50 simulation loop in the browser before adding automation, catalogs, accounts, or backend processing.

| **Phase** | **Milestone** | **Focus** |
| --- | --- | --- |
| **Phase 0** | **Foundation & Color Core** | Browser app shell, image upload, Canvas 2D pipeline, manual RGB/Hex + LRV input, and D50 color utility tests. |
| **Phase 1** | **Fidelity MVP** | Manual brush/eraser masking, LAB D50 delta-transfer simulation, LRV consistency warnings, before/after, and local export. |
| **Phase 2** | **Validation & Tuning** | Delta-E tooling, visual regression photos, RGB ratio debug comparison, and evidence-based LRV/gamut tuning decisions. |
| **Phase 3** | **UX Automation** | SAM-assisted wall selection behind a segmentation boundary, with manual refinement preserved as fallback. |
| **Phase 4** | **Paint Catalog** | Cross-brand color schema, seed catalog, search/filter, recent colors, and multi-color comparison. |
| **Phase 5** | **Beta Readiness** | Cross-browser QA, performance budget, privacy copy, feedback capture, and KPI/event logging. |

---

## 7. Success Metrics (KPIs)

* **Visual Fidelity:**  Do simulations of known samples match real-world photos within a delta-E threshold?
* **Masking Speed:**  Time taken for a user to successfully mask a wall (Target: \<30 seconds for Phase 1; \<5 seconds for Phase 3).
* **Retention:**  Number of users who save more than 3 simulations.

---

## 8. Out of Scope

* **White Wall Baseline:**  Estimating lighting from a neutral "white patch" is deprioritized to focus on Paint A calibration.
* **3D Room Modeling:**  No AR or 3D mesh generation; focus entirely on 2D photo-realistic color transfer.
