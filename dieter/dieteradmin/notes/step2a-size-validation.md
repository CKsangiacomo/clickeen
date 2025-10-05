# Step 2a — Size Ramp Validation

All newly added CSS contracts reference Dieter spacing and control tokens derived from the 8px system:

- Primitives (Link, Spinner) rely on `--space-*`, `--fs-*`, and control radius tokens.
- Forms (Input, Textarea, Checkbox, RadioGroup, Select, Switch, Fieldset) map data-size modifiers to Dieter control heights (`--control-radius-sm|md`, inline spacing multiples of `--space-2…--space-6`).
- Overlays use layout spacing tokens (`--space-4`, `--space-6`, etc.) and clamp widths in rem (multiples of 8px equivalents).
- Patterns & Extras maintain padding/margins via `--space-*`, with typography set through `--fs-*` tokens; Pulsar/Spinner animations retain proportionate radii.

No hard-coded pixel values outside the 8px-derived conversions were introduced.
