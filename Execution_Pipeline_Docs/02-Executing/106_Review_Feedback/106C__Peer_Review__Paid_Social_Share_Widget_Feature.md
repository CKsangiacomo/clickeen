# 106C Peer Review - Paid Social Share Widget Feature

Status: Historical review feedback / superseded by `106H__Audit_Refresh_Decision_Log.md` 2026-06-04 system tenets audit
Date: 2026-06-03
Reviewed PRD: `../106C__PRD__Paid_Social_Share_Widget_Feature.md`

## Review Lens

Social share is a widget-package feature.

It must not become:

- a Page Composer feature;
- a block/section subsystem;
- Prague host chrome copied into customer pages;
- a client-only entitlement gap;
- a new analytics/share-campaign platform.

The boring product shape is:

```text
behavior.socialShare.enabled
  -> checked by policy
  -> emitted or not emitted by Builder/Roma saved package output
  -> absorbed by Page Composer if present
```

## Consolidated Verdict

106C is directionally correct but not execution-ready.

The product boundary is right:

- Prague `InstanceEmbed` remains the UX reference/showcase chrome.
- Customer-hosted output gets social share inside generated widget packages.
- Page Composer stays dumb and never injects paid share UI.

The PRD needs sharper execution boundaries:

- Roma save must be the final server-side account-policy gate before package bytes reach Tokyo.
- The policy flag needs explicit tier values and typed registry support.
- Widget `limits.json` needs exact mappings.
- Widget specs need a real toggle/default/normalization path.
- Generated share runtime must be root-scoped and multi-instance safe.
- Share target behavior must be explicit for single widgets versus composed pages.

## Agent1 - Staff Engineer Review

### Elegant Engineering And Scalability

Good:

- One config field: `behavior.socialShare.enabled`.
- One entitlement key: `widget.socialShare.enabled`.
- One generated-package behavior: either share exists in `index.html/styles.css/runtime.js`, or it does not.
- Page Composer consumes the generated package as-is.

Blocking gaps:

- Final execution removed `materializeInstancePublicArtifacts`; Tokyo no longer renders widget package bytes.
- Roma save carries account policy and rejects non-entitled share-enabled config before package bytes reach Tokyo.
- Bob can reject ops, but Bob is not the server boundary.
- Prague share chrome is iframe host chrome. It cannot be copied directly into widget packages.

### Architecture / Tenet Compliance

Compliant:

- No page-level share feature.
- No block object.
- No Page Composer entitlement logic.
- Policy truth belongs in `ck-policy`.

Not compliant yet:

- The PRD does not name the final server enforcement boundary.
- It does not say whether non-entitled enabled config is rejected at save or sanitized later; final direction is save rejection at Roma.
- It does not require the social share runtime to use only `CK_WIDGETS[instanceId]`.
- It does not specify widget spec edits, so Bob has no concrete editor/default path.

### Overarchitecture / Gold-Plating Risks

Do not add:

- channel registry;
- analytics dashboard;
- share campaign entity;
- placement-level share config;
- page share API;
- custom share-copy editor;
- fourth generated package file.

The V1 implementation should be shared chrome adjacent to the current paid/free widget chrome direction, not copied into each widget.

### Simple / Boring Path

Keep the feature to one shared package primitive:

```text
if policy allows + config enabled:
  emit root-scoped share markup/CSS/runtime
else:
  emit nothing
```

The hard part is not product theory. The hard part is making the emission gate server-owned and deterministic.

## Agent2 - Senior PM Review

### Product UX And Scalability

Good:

- Paid value is clear: customers can let visitors share a widget or a widget placement on a page.
- Reuse is strong: the same widget instance behavior travels from single embed to page placement.
- Prague’s current overlay is a good UX reference.

UX risks:

- Prague copy is Clickeen-centered. Paid customer output needs customer/value-centered copy, not “This Clickeen widget is awesome.”
- Prague currently shares `window.location.href` plus an anchor/ref. In a single widget iframe, that shares the widget URL. In a composed page, it should share the page URL plus placement anchor.
- The Prague menu is large. Copying every channel and inline SVG into every generated widget package can bloat pages fast.
- Public share strings and toast text need locale awareness.

### Architecture / Tenet Compliance

Compliant:

- Page Composer rule is correct: if the package contains share, the page contains share.
- The feature works through widget packages, not page source.
- Bob handles the editor upsell path.

Needs tightening:

- Server enforcement must be named, because Bob gating alone is not enough.
- Share target behavior must be explicit.
- Generated package output must not inherit Prague iframe-resize or host-page assumptions.

### Overarchitecture / Complexity

Keep out of 106C:

- analytics;
- attribution dashboards;
- page-level share UI;
- social share customization UI;
- per-channel configuration;
- parent-window handshake.

Those may be future product ideas, but they are not needed for V1.

### Simple / Boring Product Path

The product should be:

- toggle in Bob;
- upsell if the account is not entitled;
- generated package emits share if allowed;
- public widget/page visitor sees the share control;
- Page Composer does not know why it is there.

## Agent3 - Principal TPM Review

### Cohesive / Cost-Effective Architecture

Good:

- Uses the existing policy stack instead of inventing a paid-feature subsystem.
- Uses current widget package files instead of a page runtime feature.
- Lets edge serving stay static.

Operational gaps:

- Current policy metadata already admits server save/publish enforcement gaps for similar widget flags.
- If an account loses entitlement while config still says enabled, stale paid output must not remain public.
- Page composition with two share-enabled widgets needs root-scoped handlers and bounded global listeners.

### Systems That Talk To Each Other

Surviving authorities should be:

- `packages/ck-policy`: entitlement truth and typed key.
- Widget `limits.json`: maps `behavior.socialShare.enabled` to the entitlement key.
- Bob: editor rejection/upsell.
- Tokyo publish/materialization: final server-side emission gate.
- Page Materializer: no entitlement logic and no share injection.
- Prague: reference/showcase chrome only.

### SaaS-Grade Technical Bar

To be SaaS-grade, 106C needs:

- deterministic paid output removal on downgrade/non-entitlement;
- no share feature emitted from stale config;
- no per-widget unbounded document listeners;
- no `window.CK_WIDGET` dependency;
- no request-time page share assembly;
- tests proving two share-enabled widgets can coexist.

### Recommended Sequence

Recommended implementation order:

```text
106A shared package/runtime cleanup
106B absorbable package contract
106C paid social share package feature
106F page materializer
106G edge serving/cache/SEO
```

106C can be amended now, but implementation should not add new runtime code before 106A/106B remove the old global/runtime assumptions.

## Consolidated Required PRD Decisions

Before executing 106C, decide:

1. **Server Enforcement Boundary**
   - Tokyo publish/materialization must receive or resolve account policy.
   - Non-entitled enabled config must not emit share markup/CSS/runtime.

2. **Reject Or Sanitize**
   - If `behavior.socialShare.enabled === true` and policy denies `widget.socialShare.enabled`, choose one:
     - reject publish/materialization;
     - sanitize to disabled before package generation.
   - Recommended: reject at publish/materialization and let Bob upsell earlier.

3. **Entitlement Tier Values**
   - Define exact matrix values for `widget.socialShare.enabled`.
   - Example decision to evaluate: `free: false`, paid tiers true.

4. **Exact Limits Mapping**
   - Each target widget should map the config path:

```json
{
  "kind": "flag",
  "key": "widget.socialShare.enabled",
  "path": "behavior.socialShare.enabled",
  "mode": "boolean",
  "deny": true,
  "sanitizeTo": false,
  "enforce": { "load": "sanitize", "ops": "reject", "publish": "reject" }
}
```

5. **Widget Spec Edits**
   - Add default `behavior.socialShare.enabled: false`.
   - Add boolean normalization.
   - Add a Settings toggle in the current widget editor contract for FAQ, Countdown, and Logo Showcase.

6. **Generated Package Implementation**
   - Do not copy Prague iframe host chrome.
   - Implement one shared root-scoped package feature.
   - Emitted markup lives inside the extractable widget fragment.
   - CSS lives in `styles.css`.
   - Runtime lives in `runtime.js` and uses `CK_WIDGETS[instanceId]` only.

7. **Share Target Contract**
   - Single public widget: share the public widget URL.
   - Composed page: share the page URL plus placement anchor.
   - Do not add parent-window discovery or page handshake in V1.

8. **Locale Behavior**
   - Public share labels, messages, and toast text must be locale-aware.
   - Do not ship hardcoded English customer-facing runtime copy.

9. **Package Size / Channel Scope**
   - Decide whether V1 ships the full Prague channel list or a smaller default set.
   - Avoid inlining a large SVG/channel payload into every widget instance without an explicit size decision.

## Suggested Acceptance Gates

106C should fail if:

- `widget.socialShare.enabled` is missing from matrix, registry, flag keys, metadata, tests, or entitlement snapshot validation.
- Relevant widget `limits.json` files do not map `behavior.socialShare.enabled`.
- Bob does not reject/upsell a non-entitled toggle attempt.
- Tokyo publish/materialization can emit share markup for a non-entitled account.
- Entitled+enabled materialization does not emit share markup/CSS/runtime into the three generated files.
- Downgrade or stale config can leave paid share output public.
- Share runtime reads `window.CK_WIDGET`.
- Two share-enabled widgets on one composed page collide.
- Page Materializer injects or reasons about share UI.
- Prague `InstanceEmbed` share chrome regresses.

## Decision Status

Do not execute 106C as-is.

Keep the direction, but amend it into a strict paid package feature contract. The feature is valuable because it rides the widget system; if it becomes page logic or client-only entitlement gating, it creates exactly the kind of subsystem Clickeen Pages is trying to avoid.
