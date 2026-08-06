# SEO/GEO/AEO Capability

STATUS: DIRECTIONAL CAPABILITY NOTE WITH CURRENT RUNTIME GUARDRAILS

SEO/GEO/AEO is a Clickeen direction, not a fully specified operator contract
yet. Keep this page honest: it records what is true today and the direction we
intend to build without inventing routes, agents, crawlers, telemetry, or schema
machinery that does not exist.

## Code Authority

| Concern | File |
| --- | --- |
| Current public widget serving | `tokyo-worker/src/routes/clk-live-routes.ts` |
| Account instance package state | `tokyo-worker/src/domains/account-instances/serve-state.ts` |
| Account instance package files | `tokyo-worker/src/domains/account-instances/package-files.ts` |
| Public package metadata | `tokyo-worker/src/domains/public-package-serve-metadata.ts` |
| Roma instance save route | `roma/app/api/account/instances/[instanceId]/route.ts` |
| Roma instance publish route | `roma/app/api/account/instances/[instanceId]/publish/route.ts` |
| Roma public package builder | `roma/lib/account-instance-public-package.ts` |
| Roma public-serving origin env | `roma/lib/env/public-serving.ts` |
| Roma page publish disabled route | `roma/app/api/account/pages/[pageId]/publish/route.ts` |
| Policy registry/matrix | `packages/ck-policy/src/registry.ts`, `packages/ck-policy/entitlements.matrix.json` |

## Current Runtime Truth

Current public widget serving is generated-file serving.

```text
https://dev.clk.live/{accountPublicId}/{instanceId}
https://clk.live/{accountPublicId}/{instanceId}
```

Public visitor requests:

- receive generated files from Tokyo-worker/R2;
- do not fetch authoring JSON;
- do not fetch overlay JSON directly;
- do not call Bob/Roma account APIs;
- do not call San Francisco or an agent endpoint;
- do not compose translations at request time.

Generated account instance package files live under:

```text
accounts/{accountPublicId}/instances/{instanceId}/
  serve-state.json
  index.html
  styles.css
  runtime.js
```

Public serving is gated by the stored publish/package state. Unpublished,
missing, malformed, or mismatched package state returns `404`. Public page
serving currently returns `404` because page package serving is not active.

Public-serving hosts must expose generated artifacts only. Operational paths
such as `/healthz`, `/__internal/*`, and `/widgets/*` return `404` on
`dev.clk.live` and `clk.live`.

## Current Policy Key

The policy registry currently contains this key:

```text
embed.seoGeo.enabled
```

Current policy source:

```text
packages/ck-policy/entitlements.matrix.json
packages/ck-policy/src/registry.ts
```

Current runtime gap: the key exists in policy metadata, but current runtime code
does not prove an active SEO/GEO entitlement gate in Roma save, Roma publish, or
Tokyo-worker public serving. Until code consumes the key on a product path, this
is policy metadata, not an enforced runtime entitlement.

Operator warning: `packages/ck-policy/src/registry.ts` currently marks
`embed.seoGeo.enabled` as `enforced` and names Roma product save/publish/public
code flow as owner. Runtime evidence does not currently prove that consumer.
For this capability, treat the registry row as conflicting metadata until a
real runtime consumer is implemented or the registry is corrected.

Tokyo-worker stores and serves submitted artifact files. It does not decide
whether an account is entitled to SEO/GEO output.

## Current Operator Rule

There is no SEO/GEO/AEO operation to run today.

Operators can currently verify only these facts:

1. The policy key exists in `@clickeen/ck-policy`.
2. Public widget serving returns generated package files for published account
   instances.
3. Page public serving is not active.
4. No current runtime path proves SEO/GEO/AEO generation, measurement, ranking
   feedback, or automatic optimization.

Do not create a work item from this page that assumes a current SEO/GEO/AEO
agent, crawler, cron job, page route, locale route, schema output, or ranking
feedback loop exists.

## Current Boundaries

SEO/GEO is not currently:

- a widget source sidecar;
- a runtime agent call;
- a public request-time rewrite;
- a locale fallback mechanism;
- a widget-source SEO/GEO sidecar contract.

Roma builds embed snippets from the public URL after publish. Public runtime
serves the generated artifact.

## Direction

Clickeen SEO/GEO/AEO will operate by public surface:

- by widget instance;
- by page when page package serving exists.

Directionally, the system should produce crawlable, high-quality public
surfaces from structured Clickeen artifacts. Translation/Babel overlays are a
key input to global availability, but current public runtime does not yet expose
locale-specific crawlable surfaces from overlays.

No implemented SEO/GEO/AEO agent exists. Directionally, such an agent would
measure, recommend, and improve public surface quality without mutating source
truth silently. Exact cron jobs, telemetry, schema, routes, ranking feedback,
answer-engine optimization, and page/widget output contracts are not specified
here.

## Current Failure Semantics

| Case | Current result |
| --- | --- |
| Unpublished widget instance | public serving returns `404` |
| Missing or malformed package state | public serving returns `404` |
| Missing package file | public serving returns `404` |
| Package metadata/fingerprint mismatch | public serving returns `404` |
| Public page request | `404` because page package serving is not active |
| Operational path on public host | `404` |
| `embed.seoGeo.enabled` absent from runtime consumer path | no SEO/GEO runtime gate is proven |

## Verification

| Concern | Current verification |
| --- | --- |
| Public widget runtime | `https://dev.clk.live/{accountPublicId}/{instanceId}` returns stored package only when instance pointer is published and package is ready |
| Stored package files | `index.html`, `styles.css`, and `runtime.js` exist under `accounts/{accountPublicId}/instances/{instanceId}/` with valid package metadata/fingerprint |
| Policy key source | `packages/ck-policy/entitlements.matrix.json` |
| Runtime entitlement gap | no proven active consumer of `embed.seoGeo.enabled` outside policy metadata/docs; registry metadata currently conflicts with runtime evidence |
| Public no-agent rule | public runtime does not call Roma/Bob/San Francisco/agents |

## References

- `documentation/architecture/RuntimeProfiles.md`
- `documentation/engineering/CloudflareOperations.md`
- `documentation/services/tokyo-worker.md`
- `documentation/capabilities/localization.md`
