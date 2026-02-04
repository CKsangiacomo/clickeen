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
branding.remove          | flag   | behavior.showBacklink           | boolean (deny false)| load+ops+publish   | sanitize on load
cap.group.items.small.max  | cap  | items[] / sections[]            | count               | ops+publish        | cap group binding
cap.group.items.medium.max | cap  | items[].subitems[]              | count               | ops+publish        | cap group binding
cap.group.items.large.max  | cap  | items[].subitems[]              | count-total         | ops+publish        | cap group binding (aggregate)
```

Notes:
- **Flags**: define deny value + optional sanitize on load (e.g., force false/empty).
- **Caps**: enforce on ops + publish; use `count-total` when you need an aggregate.
- **Budgets**: global usage counters (ex: `budget.copilot.turns`, `budget.uploads.count`) metered/enforced server-side at the cost boundary; PRDs may reference them, but they do not live in `limits.json`.
- **Upsell**: implicit on any rejected cap/budget; no per-row copy.
