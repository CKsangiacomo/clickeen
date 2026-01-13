### Entitlements Mapping — Widget Template

Tier values live in **one global matrix**:
- `config/entitlements.matrix.json`

Each widget maps those keys to its state in:
- `tokyo/widgets/{widget}/limits.json`

Use a fixed-width mapping table in a code block so it reads cleanly.

#### Limits Mapping (per widget)

```text
Key                      | Kind   | Path(s)                         | Metric/Mode         | Enforcement        | Notes
------------------------ | ------ | ------------------------------- | ------------------- | ------------------ | ---------------------------
seoGeo.enabled           | flag   | seoGeo.enabled                  | boolean (deny true) | load+ops+publish   | sanitize on load
branding.remove          | flag   | behavior.showBacklink           | boolean (deny false)| load+ops+publish   | sanitize on load
list.primary.max         | cap    | sections[]                      | count               | ops+publish        | —
list.secondary.rich.max  | cap    | sections[].faqs[]               | count               | ops+publish        | —
text.question.max        | cap    | sections[].faqs[].question      | chars               | ops+publish        | —
budget.copilot.turns     | budget | (consumed on Copilot send)      | per prompt          | session            | global budget
budget.uploads           | budget | (consumed on file pick)         | per file            | session            | global budget
```

Notes:
- **Flags**: define deny value + optional sanitize on load (e.g., force false/empty).
- **Caps**: enforce on ops + publish; use `count-total` when you need an aggregate.
- **Budgets**: per-session counters; enforced in editor runtime (Bob).
- **Upsell**: implicit on any rejected limit or budget; no per-row copy.
