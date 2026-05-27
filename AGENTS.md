<!-- GSD:project-start source:PROJECT.md -->
## Project

**ChromaMatch**

ChromaMatch is a local-first, browser-based paint visualization app for realistic wall paint simulation. Users upload a room photo, provide the known current wall paint color as Paint A, manually mask the wall, provide a target Paint B, and preview a LAB D50 delta-transfer simulation that preserves the room's photographed lighting, shadows, and texture.

The product targets DIY homeowners who are blocked by paint-choice uncertainty and interior designers who need fast, high-fidelity client previews. The MVP is a single focused editor, not a catalog-first marketplace, account system, AR tool, or 3D room modeling product.

**Core Value:** Users can trust a local browser preview to show how a new paint color will interact with their actual room lighting and wall texture.

### Constraints

- **Runtime**: MVP must run locally in the browser with no image upload to a backend - privacy and responsiveness are product requirements.
- **Stack**: Vite, React, TypeScript, Tailwind CSS, Canvas 2D, Web Workers, Vitest, and Playwright are the accepted MVP defaults from the TDD.
- **Color science**: MVP LAB values use sRGB to linear RGB to XYZ D50 to LAB D50, with the Bradford-adapted D50 matrices from the TDD.
- **Algorithm**: LAB D50 delta transfer is the default product simulation. RGB ratio may exist only as a debug/reference comparison.
- **LRV policy**: Manual LRV is required and stored, but validation-only in the MVP. Do not override RGB-derived L* by default.
- **Image sizing**: MVP may use a bounded high-quality working/export size around 2048 px max dimension. Full-resolution export is deferred.
- **Testing**: Deterministic utility tests are required for color math, LRV consistency, Delta-E, simulation, mask blending, clamping, and out-of-gamut behavior.
- **Planning docs**: `.planning/` is local-only and ignored by git because Git Tracking was set to No during initialization.
- **Workflow**: New feature implementation must not begin until this initialization and completed-ticket QA pass are captured.
- **Branching**: All feature implementation must happen on feature/phase branches and be raised as pull requests before merge.
- **Parallel work**: Parallel implementation agents must use separate git worktrees so concurrent work does not interfere in the same checkout.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommendation
## Current State
- App shell already uses Vite, React 19, TypeScript, Tailwind CSS, and lucide-react.
- Unit tests run through Vitest with jsdom.
- Browser smoke tests are configured through Playwright.
- Build currently passes after initialization QA fixes.
- Playwright is blocked by local Node `v19.2.0` ESM loader support. Use Node 20.x LTS or Node 18.19+ with required loader support before treating browser QA as complete.
## Prescriptive Choices
| Layer | Choice | Rationale |
|-------|--------|-----------|
| Frontend | Vite + React + TypeScript | Fast local iteration and strong typing for pixel and state contracts. |
| Styling | Tailwind CSS | Lightweight editor UI iteration without runtime styling dependencies. |
| Canvas | HTML Canvas 2D | Direct fit for image upload, mask editing, preview, and export. |
| Worker | Web Worker + typed arrays | Keeps full-image simulation off the main thread. |
| Tests | Vitest + Playwright | Deterministic utility tests plus browser workflow smoke tests. |
| Backend | None for MVP | Local-first image privacy and no early server complexity. |
## Avoid For MVP
- Next.js unless server routes, SEO, auth, or public content pages become core.
- Backend upload pipeline before SAM, catalog APIs, accounts, or analytics require it.
- Native app or AR stack before the browser simulation loop is validated.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

| Skill | Description | Path |
|-------|-------------|------|
| ui-ux-pro-max | "UI/UX design intelligence. 67 styles, 96 palettes, 57 font pairings, 25 charts, 13 stacks (React, Next.js, Vue, Svelte, SwiftUI, React Native, Flutter, Tailwind, shadcn/ui). Actions: plan, build, create, design, implement, review, fix, improve, optimize, enhance, refactor, check UI/UX code. Projects: website, landing page, dashboard, admin panel, e-commerce, SaaS, portfolio, blog, mobile app, .html, .tsx, .vue, .svelte. Elements: button, modal, navbar, sidebar, card, table, form, chart. Styles: glassmorphism, claymorphism, minimalism, brutalism, neumorphism, bento grid, dark mode, responsive, skeuomorphism, flat design. Topics: color palette, accessibility, animation, layout, typography, font pairing, spacing, hover, shadow, gradient. Integrations: shadcn/ui MCP for component search and examples." | `.claude/skills/ui-ux-pro-max/SKILL.md` |
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
