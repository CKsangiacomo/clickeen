# PRD — Artifact Axes: Type (owns layout variants) + Content + Skin

Status: Superseded. Directional taxonomy only; not the current execution path.
Source of truth: `documentation/` and current planning notes.


Status: Draft (currently executing)
Owner: Clickeen core platform

## 0) Summary (1 paragraph)
Clickeen already *implicitly* separates **Content**, **Layout-ish controls**, and **Skin** via Bob panels, but that separation is not a first-class platform contract. As a result, templates and Copilot behavior are currently path-driven (“which text?”) instead of intent-driven (“rewrite content” vs “change skin”). This PRD formalizes a durable architecture for all artifacts (widgets now; later emails/ads/landing pages) where the only top-level artifact axes are **Type** and **universal Content + Skin**, and any “layout” decisions are **Type-owned variants**. This enables a scalable template system (curated instances = Type + Content + Skin), and a Copilot UX that can route user requests reliably without asking “which one?” every time.

## 1) What we have now (execution truth)

### 1.1 The current editing surfaces already imply the axes
In Bob, panels already map to a conceptual ontology:
- **Content panel**: content model editing (arrays/items/pieces; titles; bodies; CTA text; logo lists; etc.)
- **Layout panel**: arrangement controls (spacing, columns, motion settings, responsive knobs)
- **Appearance panel**: paint / fills / borders / shadows / colors
- **Typography panel**: role-based text styling
- **Settings panel**: feature toggles / misc settings (plus workspace settings in some cases)

### 1.2 Templates today
Templates are already implemented as **instances** (curated instance state that users clone). This is good.
However, templates are not expressed as a product of durable axes, so we don’t yet get systematic composition (skin packs, content packs, type variants) across many artifacts.

### 1.3 Copilot today (problem)
Copilot is forced into path ambiguity:
- “rewrite the text” → *which text? header title? items? CTA?*
- “make the font stylish” → *which role? title/body/button? all?*
- “make background blue” → *stage? pod? item tiles?*

This is a symptom of missing platform-level semantics for “content vs skin vs type variants”.

## 2) The core idea (what we want)

### 2.1 The durable artifact model
For any artifact:

- **Type**: the content model + behavior + DOM contract + allowed controls.
- **Type-owned layout variants**: presentation/arrangement modes that are only meaningful inside that Type.
- **Content** (universal): the actual words/items/media/URLs the artifact is populated with.
- **Skin** (universal): appearance + typography + container framing (tokens/roles/fills/shadows/radius).

Critical clarification:
- “Layout” is not a top-level independent axis. It is almost always a **Type-owned variant set**.
  - Example: FAQ has one Type (“FAQ”) with a layout variant `layout.type = accordion|list|multicolumn`.
  - Example: InstagramFeed’s “grid/carousel/masonry” are not generic layouts—they are Type variants that require different DOM/behavior.
  - Example: LogoShowcase’s “grid/slider/carousel/ticker” are Type-owned variants (even if we call them “Type” in the widget state today).

### 2.2 What changes
We make the ontology explicit so:
- Copilot can classify user intent as **Content**, **Skin**, or **Type-variant** change.
- Templates become explicitly composable as **curated Type + Content + Skin** (and a Type-owned variant selection).
- The platform can scale beyond widgets without re-inventing “templates” per artifact category.

## 3) Why this is valuable (advantages)

### 3.1 Scales templates without special-casing
Instead of “template = special thing”, we treat templates as:
- **Content presets** (starter content payloads)
- **Skin presets** (visual themes/brand packs)
- Bound to a **Type** (and a Type-owned variant selection)

This yields combinatorial leverage without combinatorial complexity:
- We can ship new skins that apply across many types.
- We can ship new content presets that apply within a type.
- We can generate starter content from `websiteUrl` without inventing new template logic.

### 3.2 Makes Copilot intent-driven (less ambiguity)
Copilot can default intelligently:
- “Rewrite the text” → treat as **Content** rewrite; apply to all user-facing content fields in the Type.
- “Make it more modern / stylish / rounded / blue” → treat as **Skin** changes; apply to container + appearance + typography roles.
- “Make it a carousel / show as grid / add columns / autoplay” → treat as **Type variant** change.

This reduces “which one?” follow-ups and aligns Copilot with how humans think.

### 3.3 Keeps engineering elegant (no widget-specific hacks)
We avoid ad-hoc per-widget rules by introducing a reusable taxonomy + routing system:
- One classification approach works for every widget type today and new artifact types later.
- No scattered logic inside widgets; Type remains strict and deterministic.

## 4) Proposed approach (how we implement)

### 4.1 Define a canonical taxonomy of editable paths
We introduce a durable classification for “what kind of thing this path is”:
- `content`: user-facing copy and item fields
- `skin`: appearance + typography + container framing (stage/pod)
- `typeVariant`: type selector and type-owned layout/variant controls
- `behavior/settings`: toggles, feature flags, misc (still classified; used for gating)

The classification must be:
- **explicit**
- **versioned**
- **shared** (Bob + San Francisco Copilot + future artifact editors)

### 4.2 Where the taxonomy lives
We need one authoritative place for the mapping:
- Option A (recommended): `@clickeen/ck-policy` sibling package (or separate `@clickeen/ck-artifact-schema`) that defines:
  - per-Type “content paths” list/patterns
  - per-Type “skin paths” list/patterns
  - per-Type “type variant paths” list/patterns
- Option B: embed tags in `spec.json` control metadata (works, but risks drift if tags are not centrally validated)

Hard rule: no key invention; the mapping must be centrally validated.

### 4.3 Copilot routing (minimal viable behavior)
At prompt time:
1) Classify the request as `content|skin|typeVariant|mixed`.
2) If `content`: propose ops only against content paths for that Type.
3) If `skin`: propose ops only against skin paths (appearance/typography/stage/pod).
4) If `typeVariant`: propose ops against the Type selector / type-owned layout variant subtree.
5) If `mixed`: split into 2 sequential proposals (content then skin) with explicit user confirmation.

### 4.4 Templates / starter designs
We keep “templates are instances” as the primitive.
What changes is how we generate and present them:
- A template is a **curated instance bundle** described as:
  - Type variant selection
  - content preset
  - skin preset
- UI can evolve later into “swap skin” and “swap content preset” safely because axes are defined.

### 4.5 Interaction with policy / entitlements
This PRD does not change the policy architecture. It complements it:
- Policy continues to gate actions/caps/budgets via the single Upsell popup.
- The taxonomy helps Copilot avoid proposing ops against gated categories (or properly trigger upsell).

## 5) Scope / Non-goals

### In scope (v1)
- Define taxonomy categories and the durable contract.
- Implement taxonomy for existing widget types (FAQ, LogoShowcase, Countdown; InstagramFeed if/when it becomes a Tokyo 5-file widget).
- Update Copilot routing to prefer intent-based ops proposal.

### Out of scope (v1)
- Full “skin marketplace” or workspace-level theme library (can come later).
- Reworking widget build pipeline; Tokyo 5-file model stays.
- Automatic semantic understanding without rules (we rely on explicit mapping).

## 6) Developer LOE (rough)
This is a platform-level change spanning docs + Copilot + editor behavior:

- **Design + docs**: 0.5–1 day
- **Create shared taxonomy module + types**: 1–2 days
- **Tag/map existing widgets (FAQ, Countdown, LogoShowcase)**: 1–2 days
- **Copilot routing implementation + prompt updates**: 2–4 days
- **Verification + UX polish** (edge cases, mixed intents): 1–2 days

Rough total: **~1–2 weeks** depending on how much Copilot + UI polish we require in v1.

## 7) Risks / failure modes (and how we prevent them)
- **Drift**: mapping differs across services → solved by one shared package + typed keys and validation.
- **Overreach**: taxonomy tries to be “smart AI” → solved by explicit mapping, not heuristics.
- **Widget-specific exceptions**: solved by refusing bespoke tags and requiring registry-backed mapping.

## 8) Acceptance criteria
1) For an implemented widget, Copilot can answer:
   - “rewrite the text” without asking “which text?” by defaulting to **Content** for that Type.
   - “make it more modern” by defaulting to **Skin** changes.
2) Template cloning remains “instance clone”, but we can optionally apply a new skin preset to an existing instance without breaking Type behavior.
3) No changes to runtime determinism; all changes are editor-time ops only.

