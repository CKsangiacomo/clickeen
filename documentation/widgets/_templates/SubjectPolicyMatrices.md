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
- **Limits**: enforce on ops + publish for widget structure; global usage counters or storage quotas (ex: `copilot.turns.monthly.max`, `storage.bytes.max`) are metered/enforced server-side at the cost boundary and do not live in widget `limits.json`.
- **Upsell**: implicit on any rejected plan limit; no per-row copy.
