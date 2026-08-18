# Services Operator Manual

STATUS: CURRENT SYSTEM OPERATOR SPEC

This folder documents current runtime services. Each file is an operator manual:
what the service owns, what it must not own, the runtime routes/config it uses,
and how to verify work through the owning surface.

Services in this folder are application, storage, data, design-system, and
public-site surfaces:

| Service | Manual |
| --- | --- |
| Berlin auth/session | `documentation/services/berlin.md` |
| Bob widget editor | `documentation/services/bob.md` |
| DevStudio human cockpit | `documentation/services/devstudio.md` |
| Dieter design system | `documentation/services/dieter.md` |
| Michael Supabase/Postgres | `documentation/services/michael.md` |
| Prague marketing site | `documentation/services/prague/prague-overview.md` |
| Roma account app | `documentation/services/roma.md` |
| Tokyo R2/static deploy contract | `documentation/services/tokyo.md` |
| Tokyo-worker R2 boundary | `documentation/services/tokyo-worker.md` |

## Shared-Service Law

Clickeen services are horizontal system capabilities. A Widget is autonomous
product software that uses those capabilities; a service is not a container for
the Widget and must not learn the Widget's unique meaning.

- Bob is one browser-memory editing service used through the same structured
  editing contract by every Widget.
- Roma is one current-account, command, and materialization service used
  through the same lifecycle by every Widget.
- Tokyo-worker is one storage and public-serving service for exact artifacts;
  it does not interpret Widget semantics.
- If a real Widget requires a missing shared capability, extend the owning
  service once through a Widget-neutral contract. Do not add a Widget-name
  branch or a second workflow for that Widget.

Tier limits and their commercial outcome follow that same split. The system
owns entitlement keys, plan values, the current and next eligible plan, and the
Upgrade action. A Widget only maps its unique state/action coordinate to a
generic system entitlement and supplies the exact localized contextual body
template for that Widget-bound denial. Bob applies the exact policy snapshot at
its shared editing boundary and carries the denied capability and message
identity to Roma without Widget-specific code. Roma composes and hosts the one
shared upsell Popup from system plan truth, the compiled Widget message, and
system-owned actions. Dieter owns Popup mechanics only. Save, materialization,
Tokyo-worker, and public serving trust the already-authorized result and do not
run the same limit decision again.

Missing Widget upsell copy fails when the git-authored Widget artifact is
produced. Runtime consumers do not substitute generic copy, recover by choosing
another message, or reconstruct the Widget's meaning.

The shared lifecycle is static-first: Create writes the first editable source
and Save updates it. Only explicit allowed Publish asks Roma to materialize
complete semantic base HTML, complete CSS, and mandatory JavaScript;
Tokyo-worker stores and serves those exact artifacts. Save remains Bob's
editable-source persistence boundary. Bob preview uses deploy-built Widget
software plus the one current draft; it never reads or executes the stored
public package. An explicit locale overlay is expressed into semantic HTML at the
Edge; it does not create a locale-derived stored package or defer content to
client JavaScript.

The generation/storage boundary is exact. One account instance is one complete
logical state containing shared Header/Stage/Pod/capability values and Core
values. Bob edits it; Roma's generic Widget materializer is the sole service
that generates the served complete `index.html`, complete `styles.css`, and
mandatory `runtime.js` only on explicit allowed Publish;
Tokyo-worker only physically writes and serves the source/package objects.
Tokyo-worker never compiles or renders Widget software, and
public delivery never calls Roma to regenerate it.

Clickeen is also a closed, trusted system. Authentication, authorization,
browser-origin checks, upload safety, public route coordinates, and acceptance
of human, model, provider, or integration input remain at the boundary where
non-Clickeen input enters. After a named Clickeen authority produces an exact
artifact or result, downstream Clickeen services consume it directly. They do
not add another semantic guard, validator, allowlist, filter, normalizer,
fingerprint comparison, or repair pass to re-prove the producing authority.

Transport decoding is not permission to reinterpret product meaning. A real
owner operation may fail and that failure remains explicit; a downstream
service must not replace, heal, omit, or redescribe the result.

AI execution systems live in `documentation/ai/`, not here. San Francisco,
Ombra, Product Copilot, Translation Agent, and planned agents are
documented there because their primary authority is AI operation, not product
surface storage or UI.

`documentation/services/prague/` is nested because Prague has several local
operator contracts: overview, section registry, layout, and copy style. Prague
is still one service.

Do not put planning docs, withdrawn work, old architecture notes, PRDs, or
execution history in this folder. Those belong in `Execution_Pipeline_Docs/` or
`documentation/strategy/` depending on whether they are execution records or
high-level direction.
