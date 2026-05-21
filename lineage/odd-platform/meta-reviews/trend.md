# Panel trend — scorecard over time

One row per `/panel` run, appended by the chair. This is the trajectory: it answers whether the methodology is converging (scores rising, findings shrinking) or thrashing (flat/falling scores, findings recurring) across runs.

Axis scores are 0-10. Verdict is `GO` / `GO-WITH-CHANGES` / `STRUCTURAL-RETHINK`. Scores carry run-to-run noise (the panel runs once per cycle, not median-of-3) — read the **trend**, not a single row, and weight the evidence-anchored findings in each `panel-report.md` over the precise score.

| Date | Verdict | Overall | Cov | Proc | Cost | Depth | Use | Hon | Consensus findings | Headline |
|---|---|---|---|---|---|---|---|---|---|---|
<!-- chair appends one row per run below this line -->
| 2026-05-21 | GO-WITH-CHANGES | 5.7 | Cov 6 Proc 5 Cost 4 Depth 6 Use 7 Hon 6 | 8 | Maiden lite run — sound architecture, specified ahead of execution; 62% of findings invisible (stale indexes), Stress Protocol at 3/144, no closed-LSN regression |
| 2026-05-21 | GO-WITH-CHANGES | 5.7 | Cov 6 Proc 5 Cost 5 Depth 7 Use 6 Hon 5 | 11 | First full run — design sound, accretion debt now a hard blocker (test-map index at 157% of load limit); Stress Protocol at 5.4% of sidecars, probe loop open, one inverted HIGH-severity RNG claim; no closed-LSN regression |
