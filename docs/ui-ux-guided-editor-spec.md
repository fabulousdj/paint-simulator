# ChromaMatch Guided Editor UX Spec

## Purpose

This document defines the target web UI/UX model for ChromaMatch's MVP editor. The app should first guide new users through the required sequence to produce a trustworthy first preview, then transition into a flexible active editor where paint changes, wall edits, comparison modes, and export are always accessible.

## Product UX Principles

- Start guided, then become flexible after the first successful preview.
- Keep the photo/preview as the primary object on screen.
- Make local-only privacy and preview trust visible without overwhelming the workflow.
- Treat masking as the most tactile task and paint entry as an iterative comparison task.
- Use gated forward progress during the first journey, but always allow users to go back to completed steps.
- Avoid exposing diagnostics by default. Keep technical details available in an advanced section.

## High-Level Modes

### Mode 1: First-Run Guided Journey

The guided journey is shown when the current photo has not produced its first rendered preview.

Steps:

1. Photo
2. Wall
3. Colors
4. First Preview

Rules:

- Show a progress bar during this mode.
- Forward navigation is gated by the current step's validity.
- Completed previous steps are clickable and editable.
- Future invalid steps are locked.
- Uploading a new photo resets the journey.
- The first valid color pair should auto-generate the first preview.
- Once the first preview completes, transition to Active Editor mode.

### Mode 2: Active Editor

The active editor is shown after the first successful preview for the current photo.

Rules:

- Do not show the progress bar.
- Show the preview/display as the primary workspace.
- Provide top-level access to Paints, Edit Wall, comparison mode, and Download.
- Paint controls open in a right overlay drawer.
- Wall editing opens a dedicated wall mode.
- Changes to paints or mask mark the preview as stale and require an explicit Update Preview action.

## Global Web Shell

### Top Bar

Visible in both modes.

Content:

- Brand: ChromaMatch
- Privacy badge: Local only
- Current photo state: No photo, Photo loaded, Updating locally, Preview ready, Needs update

Guided journey additions:

- Progress indicator: Photo, Wall, Colors, Preview

Active editor additions:

- Paints button
- Edit Wall button
- Download PNG button
- Optional advanced/diagnostics trigger

### Status Messaging

Use a compact status strip or chip for blockers and preview state.

Primary statuses:

- Waiting for photo
- Photo ready
- Select a wall area
- Enter paint colors
- Generating preview locally
- Preview ready
- Preview needs update
- Preview failed

## Guided Journey Screens

### Step 1: Photo

Goal: upload a room photo with confidence.

Primary content:

- Large upload dropzone.
- Accepted formats: JPG, PNG, WebP, HEIC, HEIF.
- Privacy copy: Your photo stays in your browser. Nothing is uploaded.
- Photo quality tips: use good light, include the target wall, avoid blur, avoid extreme perspective if possible.

CTA behavior:

- Continue disabled until the image is decoded and ready.
- After success, CTA reads Continue to wall selection.

Invalid/error states:

- Unsupported file type: show inline error near upload control.
- Decode failure: explain that the file could not be read locally.
- Loading: show Decoding photo locally.

### Step 2: Wall

Goal: select the wall area before entering paint information.

Primary presentation:

- Large canvas workspace.
- Mask overlay visible by default.
- Primary instruction: Click inside the wall to select it.
- Primary tool: Smart select / edge fill.

Secondary refinement section:

- Brush
- Eraser
- Polygon add
- Polygon remove
- Undo
- Redo
- Reset mask
- Brush size
- Brush opacity
- Edge tolerance
- Overlay toggle

CTA behavior:

- Continue disabled until the mask contains selected pixels.
- Once valid, CTA reads Continue to paint colors.

UX hierarchy:

- Smart select should be visually dominant.
- Refinement tools should be available but quieter.
- The user should always see a clear next action.

### Step 3: Colors

Goal: enter current and target paints in one place so users can compare and revise easily.

Layout:

- Two side-by-side paint cards on desktop.
- Left card: Current wall paint.
- Right card: Target paint.
- A swatch transition summary appears above or between the cards.

Each paint card includes:

- Hex/RGB input mode.
- Color input.
- Manual LRV input.
- Swatch preview.
- Computed LRV.
- LRV delta.
- Inline validation and warning messages.

Trust note:

- Preview uses LAB D50 delta transfer to preserve photographed lighting, shadows, and wall texture.

CTA behavior:

- First valid Current and Target pair auto-generates the first preview.
- While generating, CTA reads Generating preview locally and is disabled.
- If generation fails, show error and allow Retry.
- Once the first preview is ready, move to the First Preview screen.

### Step 4: First Preview

Goal: show the result and complete the guided journey.

Default display:

- Split comparison mode.

Available comparison modes:

- Split
- Toggle
- Side by side

Status content:

- Preview ready.
- Affected pixels.
- Clipped pixels.
- LRV warnings, if any.
- Generated locally.

Primary CTA:

- Continue editing or Download PNG.

Transition:

- After this screen has shown a completed preview, switch the app into Active Editor mode.

## Active Editor

### Primary Layout

The active editor is preview-first.

Top controls:

- Paints
- Edit Wall
- View mode: Split, Toggle, Side by side
- Update Preview, shown when stale
- Download PNG, enabled only when preview is current and complete

Primary display:

- Large preview canvas.
- Current comparison mode is visible and switchable.
- Status chip overlays or sits near the display: Preview ready, Needs update, Updating locally.

No progress bar should be shown in this mode.

### Paint Drawer

Trigger:

- Paints button in the active editor top bar.

Presentation:

- Right-side overlay drawer.
- Width target: 360-420px on desktop.
- Drawer overlays the preview but does not replace it.
- Preview remains visible behind and to the left of the drawer.
- Use a clear close button and support Escape to close.

Content:

- Current wall paint card.
- Target paint card.
- Current to Target swatch summary.
- LRV warnings.
- Preview status.
- Update Preview CTA when changes are valid but not rendered.

Behavior:

- Editing colors after a completed preview marks preview as Needs update.
- Do not auto-regenerate after the first preview.
- If values are invalid, keep Update Preview disabled and show inline validation.
- Closing the drawer preserves current edits.

### Dedicated Wall Mode

Trigger:

- Edit Wall button in active editor.

Presentation:

- Replaces the preview workspace with the wall mask editing workspace.
- Does not show the first-run progress bar.
- Does not show paint inputs.

Controls:

- Smart select primary tool.
- Secondary refinement tools: Brush, Eraser, Polygon add, Polygon remove, Undo, Redo, Reset mask, size, opacity, tolerance, overlay toggle.
- Return to Preview.
- Cancel, if draft editing is supported later.

Behavior:

- Existing mask is preserved.
- If mask changes, returning to preview marks the preview as Needs update.
- Download is disabled while the preview is stale.
- The user should always have an obvious route back to preview.

## Preview Comparison Modes

### Split

Default mode for first preview.

Behavior:

- Original image on one side, simulated result on the other.
- User can drag the divider.
- If drag is not implemented initially, use a fixed 50/50 split as a temporary fallback.

### Toggle

Behavior:

- User switches the whole display between Before and After.
- Useful for quick whole-image comparison.

### Side By Side

Behavior:

- Original and simulated images appear next to each other.
- Best for desktop review.
- If viewport is narrow, stack the images vertically or fall back to Toggle.

## Navigation And State Rules

### First-Run Gating

- Photo step unlocks Wall only after a decoded image exists.
- Wall step unlocks Colors only after a non-empty mask exists.
- Colors step unlocks Preview only after valid Current and Target paints exist and preview generation starts.
- Preview is complete only after simulation finishes successfully.

### Back Editing

- Users can always return to completed first-run steps.
- Changing the photo resets mask, paints-dependent preview, and export readiness.
- Changing the mask after preview marks the preview as Needs update.
- Changing paints after preview marks the preview as Needs update.

### Preview Freshness

States:

- No preview: first preview has not been generated.
- Generating: worker is producing a preview.
- Ready: preview matches current image, mask, and paints.
- Needs update: current inputs changed after the last completed preview.
- Failed: simulation failed and can be retried.

CTA mapping:

- No preview with valid inputs: Generate preview or auto-generate during first run.
- Generating: disable Download and Update Preview.
- Ready: enable Download PNG.
- Needs update: enable Update Preview, disable Download PNG.
- Failed: show Retry.

## Advanced And Diagnostics

Diagnostics should be collapsed by default.

Candidate content:

- Simulation mode: LAB D50 delta, RGB ratio debug.
- Affected pixel count.
- Clipped pixel count.
- Working image dimensions.
- Mask selected pixel count.
- LRV consistency details.

Default users should not need this section to complete the workflow.

## Accessibility And Interaction Requirements

- All controls require visible focus states.
- All buttons and inputs should meet a minimum 44px target height where practical.
- Form inputs must have labels, not placeholder-only labels.
- Icon-only buttons need aria-labels.
- Color is not the only indicator for validity or state.
- Drawer close must be keyboard accessible.
- Escape should close the paint drawer when open.
- Avoid hover-only critical interactions.
- Maintain readable text contrast of at least 4.5:1 for normal text.

## Visual Direction

- Style: clean expert utility.
- Mood: trustworthy, precise, calm, local-first.
- Palette: teal/blue trust palette with neutral canvas surfaces.
- Typography: system sans or Inter-like sans for app UI.
- Avoid decorative typefaces in the editor.
- Use Lucide or another consistent SVG icon set.
- Do not use emoji icons.
- Keep animation subtle: 150-300ms transitions for drawers, hover states, and state changes.

## Implementation Notes

- The current MVP can map to this model without changing the underlying color or simulation pipeline.
- Existing controls can be reorganized into guided screens, then reused in the active editor drawer and dedicated wall mode.
- The state model needs a durable flag for whether the current photo has completed its first preview.
- Preview freshness should be derived from the current image, mask, paint inputs, and the inputs used to generate the latest result.
- The first preview should auto-run once image, mask, Paint A, and Paint B are valid.
- After the first preview, paint and mask changes should require explicit Update Preview.
