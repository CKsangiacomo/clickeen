### Entitlements Mapping — Widget Template

Tier values live in **one global matrix**:
- `packages/ck-policy/entitlements.matrix.json`

Each widget maps those keys to its state in:
- `tokyo/product/widgets/{widget}/limits.json`

Use a fixed-width mapping table in a code block so it reads cleanly.

#### Limits Mapping (per widget)

```text
Key                        | Kind   | Path(s)                         | Metric/Mode          | Enforcement        | Notes
-------------------------- | ------ | ------------------------------- | -------------------- | ------------------ | ---------------------------
branding.remove            | flag   | behavior.showBacklink           | boolean (deny false) | load+ops+publish   | sanitize on load
items.group.small.max  | limit  | items[] / sections[]            | count                | ops+publish        | limit group binding
items.group.medium.max | limit  | items[].subitems[]              | count                | ops+publish        | limit group binding
items.group.large.max  | limit  | items[].subitems[]              | count-total          | ops+publish        | limit group binding (aggregate)
```

Notes:
- **Flags**: define deny value + optional sanitize on load (e.g., force false/empty).
- **Limits**: map widget paths/ops to global policy keys. Today the proven shared widget enforcement is Bob editor ops; save/publish enforcement must be explicit in code, tests, and `ck-policy` registry status before a PRD can claim it.
- **Upsell**: implicit on any rejected plan limit; no per-row copy.
