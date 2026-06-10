# Local Runtime

`bash scripts/dev-up.sh` is the canonical local support-stack boot.

It does one thing:
- start Bob, Berlin, Tokyo CDN stub, and Tokyo-worker
- verify the local stack before finishing

Local boot topology:
- Bob: `http://localhost:3000`
- Berlin: `http://localhost:3005`
- Tokyo CDN stub: `http://localhost:4000`
- Tokyo-worker: `http://localhost:8791`

DevStudio is not part of `dev-up`. Its canonical internal runtime is
`https://devstudio.clickeen.com` on Cloudflare Pages behind Berlin/Google auth.
Package-level local DevStudio may still be used for fast static UI iteration, but
it is not product-state evidence and must not own hidden local write lanes.

There are no alternate local runtime modes behind `dev-up`. Local development
should not require developers to reason about multiple boot topologies behind one
script.

Tokyo-worker keeps the same PBX boundary locally that it has in deployed runtime.
It may validate auth/dev tooling credentials, account capsule to path match,
method/path/ID shape, widget codebook, object schema, R2 existence, and technical
request bounds; it does not decide product policy, billing/tier state, publication
eligibility, l10n version caps, upload entitlements, or account storage caps.
Product state and policy still come from the real Roma -> Bob -> Tokyo account path.

Local Tokyo storage follows the PRD 099 root model:

```txt
accounts/
dieter/
fonts/
product/
prague/
```

Account-owned runtime bytes live under
`accounts/{accountPublicId}/instances/{instanceId}/` and
`accounts/{accountPublicId}/assets/`. Widget software lives under
`product/widgets/`. Public instance serving uses the environment public-serving
host plus `/{accountPublicId}/{instanceId}` and maps to generated browser files in
the instance folder. Cloud-dev uses `https://dev.clk.live`; production release
stages use `https://clk.live`. Local routes must not rely on root published, root
widgets, or account widgets storage.

Friendly local asset routes are URL conveniences only: `/widgets/{widgetType}/...`
maps to `product/widgets/{widgetType}/...`; `/dieter/...` maps to `dieter/...`;
`/fonts/...` maps to `fonts/...`; `/themes/...` maps to the canonical Dieter/theme
asset root; Prague-friendly paths map to `prague/...`. Friendly route shape must
not create a matching R2 root.

Rules:
- `dev-up` is one-command local support-stack boot.
- `dev-up` does not seed a fake platform/account lane.
- Product state must come from the real Roma -> Bob -> Tokyo account path.
