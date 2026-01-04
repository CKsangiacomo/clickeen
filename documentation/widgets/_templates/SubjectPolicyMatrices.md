### Subject Policy — Flags / Caps / Budgets (Matrices)

X-axis is the policy profile: **DevStudio**, **MiniBob**, **Free**, **Tier 1**, **Tier 2**, **Tier 3**.

Use ASCII matrices in code blocks (fixed-width) so columns don’t wrap.

#### Matrix A — Flags (ALLOW/BLOCK)

```text
Legend: A=ALLOW, B=BLOCK

Row            | DS | MB | F  | T1 | T2 | T3
-------------- |----|----|----|----|----|----
seoGeoEnabled  | A  | B  | B  | A  | A  | A
removeBranding | A  | B  | B  | A  | A  | A
```

**Flag key (details)**

```text
Flag key
Row            | Path                        | Enforcement | Upsell | Meaning
-------------- | --------------------------- | ----------- | ------ | -------------------------
seoGeoEnabled  | seoGeo.enabled              | OPS+LOAD    | UP     | (example) SEO/GEO optimization toggle
removeBranding | behavior.showBacklink=false | UI+OPS      | UP     | (example) Remove branding
```

#### Matrix B — Caps (numbers)

```text
Legend: ∞ means “no cap”

Row      |  DS |  MB |   F |  T1 |  T2 |  T3
-------- |-----|-----|-----|-----|-----|-----
maxItems |   ∞ |   1 |   2 |  10 |   ∞ |   ∞
```

**Cap key (details)**

```text
Cap key
Row      | Path       | Enforcement  | Violation | Upsell | Meaning
-------- | ---------- | ------------ | --------- | ------ | -------------------------
maxItems | sections[] | OPS(insert)  | REJECT    | UP     | (example) Max sections
```

#### Matrix C — Budgets (numbers)

```text
Legend: ∞ means “no budget limit”

Row          |  DS |  MB |   F |  T1 |  T2 |  T3
------------ |-----|-----|-----|-----|-----|-----
copilotTurns |   ∞ |   4 |  20 | 100 | 300 |   ∞
edits        |   ∞ |  10 |   ∞ |   ∞ |   ∞ |   ∞
uploads      |   ∞ |   5 |   ∞ |   ∞ |   ∞ |   ∞
```

**Budget key (details)**

Budgets are **per-session counters**. When a budget reaches 0, the consuming action is blocked and the Upsell popup is shown.

```text
Budget key
Row          | Consumed when         | Counts as          | Upsell | Notes
------------ | --------------------- | ------------------ | ------ | -------------------------
copilotTurns | Copilot prompt submit | 1 per user prompt  | UP     | (example)
edits        | any successful edit   | 1 per state change | UP     | continue editing your widget by creating a free account
uploads      | choose file (if widget has uploads) | 1 per file chosen | UP | (example)
```


