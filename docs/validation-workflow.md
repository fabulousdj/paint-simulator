# Validation Workflow

Phase 2 validation uses deterministic fixtures to catch rendering regressions and compare the default LAB D50 pipeline against the RGB ratio debug baseline. These checks are regression evidence, not absolute color-truth proof.

Run the workflow with:

```bash
npm run validate:fixtures
```

What it covers:

- Synthetic bright and shadowed wall fixtures with known Paint A and Paint B values from the TDD.
- Selected-region Delta-E summaries from original pixels to simulated output.
- LAB D50 default output compared against RGB ratio debug output on the same source pixels and mask.
- Approved inline baselines for selected-region Delta-E summaries and stable output checksums.

How to interpret results:

- Inline baseline or checksum changes mean the rendering path changed and needs review.
- Delta-E values show magnitude of simulated change in selected regions; they are not a guarantee that the output matches a real painted wall.
- RGB ratio debug exists only as a comparison baseline. LAB D50 remains the default product algorithm.

Current limitation:

- Real room photos are not bundled yet because the current sample set is metadata-only. Add licensed representative photos before treating visual approval as real-world fidelity evidence.
