# Prague Strings Localization — Base + Overlays + Manifest (Instance-Style)

Status: Proposal (words-only)

Owner: Prague marketing site

## Why This Exists

We want Prague website strings (titles, CTAs, nav items, page text, UI labels — *everything*) to follow the same clean model as widget instances:

- A human-authored **Base** is the canonical source of truth (defined locally in the repo).
- Localized variants are **Overlays** (deltas) generated at build-time by an agent.
- A **Manifest** makes the system deterministic, auditable, and cacheable.
- **Allowlists** define which fields are translatable and prevent accidental “patching” of non-string data.

The goal is to avoid TS-as-content. TS/JS should be infrastructure only (fingerprints, validation, compilation), not the place where strings live.

## System-Owned Localization (San Francisco)

Prague strings are **system-owned**. All localization must be executed by San Francisco:

- **No direct provider calls** (OpenAI/Claude/DeepSeek) from build scripts.
- **API keys live only in San Francisco**.
- Prague localization jobs must be routed through the **localization agent** in San Francisco.

San Francisco selects provider/profile deterministically:

- `surface = prague` and `kind = system` → **OpenAI** (highest quality).
- `kind = user` → provider selected by tier/entitlements (lower tier vs higher tier).

## Job Contract (Prague)

Every Prague localization job must include:

- `surface`: `prague`
- `kind`: `system`
- `chunkKey`: `{pagePath}/blocks/{blockId}` or `shared/{key}`
- `blockKind`: for allowlist selection
- `baseFingerprint`: computed from base chunk
- `baseUpdatedAt`: timestamp of the base chunk
- `allowlistVersion` (or hash)
- `promptVersion` / `policyVersion` (for auditability)

## Instance Model (Reference)

Instance localization is clean because it has:

- **Base**: the canonical, locale-free instance config.
- **Overlays**: `ops` patches that only set allowlisted paths.
- **baseFingerprint** gating: overlays apply only when the base matches.
- **Manifest**: deterministic mapping from `(publicId, locale)` to the overlay artifact.

This proposal applies the same ergonomics to Prague website strings.

## Core Concepts

### Base

The canonical, human-authored, locale-free strings for Prague.

- We treat English (EN) as the default base language.
- Base lives in plain JSON files in the repo.
- Base is split into many small “chunks” so changes have a small blast radius.

### Chunk Identity (Block Instance)

Chunks are keyed by **block instance**, not block type and not whole pages.

- Chunk key = `{pagePath}/blocks/{blockId}` (example: `routes/home/blocks/hero`).
- Block type repeats across pages but content does not, so we do **not** localize by block type.
- Each base chunk records its `blockKind` to select the allowlist and provide translator context.

### Shared Strings (Explicit Reuse)

Some strings are truly shared (nav/footer/global CTAs). Treat it as its own chunk type:

- Shared chunks live under `base/v1/shared/{key}.json`.
- Blocks can reference a shared key; the loader merges shared strings into the block instance strings.
- Shared chunks have their own allowlist and overlays.

### Overlay

A locale-specific patch that applies on top of a base chunk.

- Stored as instance-style ops: `{ op: "set", path: "...", value: "..." }`.
- Must include `baseFingerprint` computed from the base chunk.
- Must only patch allowlisted paths.

### Manifest

A deterministic index describing:

- what base chunks exist,
- what their fingerprints are,
- which locales have overlays,
- and whether overlays match the current base fingerprint.

This enables:

- “missing/stale translations” to be computed deterministically,
- CI validation,
- and stable build behavior.

### Allowlist

A set of path patterns defining what is translatable.

- Prevents translations from touching IDs, slugs, URLs, tracking params, etc.
- Makes the contract legible to humans.
- Semantics match instance allowlists (same wildcard and array rules).

## File Layout (Proposed)

Top-level folder:

```
prague-strings/
  base/
    v1/
      chrome.json
      shared/
        signup-cta.json
      routes/
        home/
          blocks/
            hero.json
            minibob.json
        privacy/
          blocks/
            hero.json
      widgets/
        faq/
          blocks/
            overview-hero.json

  allowlists/
    v1/
      chrome.allowlist.json
      shared.allowlist.json
      blocks/
        hero.allowlist.json
        minibob.allowlist.json

  overlays/
    v1/
      chrome/
        es.ops.json
        fr.ops.json
        ...
      shared/
        signup-cta/
          es.ops.json
          fr.ops.json
      routes/
        home/
          blocks/
            hero/
              es.ops.json
              fr.ops.json
        privacy/
          blocks/
            hero/
              es.ops.json
              fr.ops.json
      widgets/
        faq/
          blocks/
            overview-hero/
              es.ops.json
              fr.ops.json

  manifest.v1.json

  # Derived (generated during build):
  compiled/
    v1/
      es/
        chrome.json
        shared/
          signup-cta.json
        routes/home.json
        widgets/faq.json
        widgets/faq/
          templates.json
      fr/
        ...
```

### Notes

- `v1/` provides a stable schema boundary for future evolution.
- Split by **strings domain**:
  - `chrome`: global UI strings (nav/footer/global CTAs)
  - `routes`: marketing routes that aren’t widget-owned
  - `widgets`: widget-related strings used by Prague surfaces

## Data Shapes

### Allowlist format

Example:

```json
{
  "v": 1,
  "paths": [
    { "path": "strings.nav.*.label", "type": "string" },
    { "path": "strings.cta.*.label", "type": "string" },
    { "path": "strings.hero.subhead", "type": "richtext" }
  ]
}
```

Paths use the same semantics as instance allowlists:

- `.` separates segments
- `*` matches numeric array indexes (or a defined wildcard rule)

### Base chunk format (block instance)

```json
{
  "v": 1,
  "blockId": "hero",
  "blockKind": "hero",
  "strings": {
    "headline": "Launch faster",
    "subhead": "Ship a beautiful FAQ in minutes."
  },
  "sharedKey": "shared/signup-cta"
}
```

### Overlay format

```json
{
  "v": 1,
  "baseFingerprint": "<sha256 hex>",
  "baseUpdatedAt": "2026-01-15T00:00:00.000Z",
  "ops": [
    { "op": "set", "path": "strings.headline", "value": "..." }
  ]
}
```

Rules:

- Only `set` ops
- `value` is string (or richtext string)
- `path` must match allowlist
- Overlay must not encode locale into chunk IDs

### Manifest format

```json
{
  "v": 1,
  "gitSha": "...",
  "chunks": {
    "chrome": {
      "base": { "file": "base/v1/chrome.json", "fingerprint": "..." },
      "locales": {
        "es": { "file": "overlays/v1/chrome/es.ops.json", "baseFingerprint": "..." }
      }
    },
    "routes/home/blocks/hero": {
      "base": { "file": "base/v1/routes/home/blocks/hero.json", "fingerprint": "..." },
      "locales": {
        "fr": { "file": "overlays/v1/routes/home/blocks/hero/fr.ops.json", "baseFingerprint": "..." }
      }
    }
  }
}
```

## Build-Time Workflow

### 1) Author base locally

Humans edit only:

- `prague-strings/base/v1/**.json`

### 2) Generate overlays (agent)

A build script:

- loads a base chunk (block instance or shared),
- selects allowlist by `blockKind` (or `shared`/`chrome`),
- extracts allowlisted strings from `strings`,
- calls the localization agent via **San Francisco** with `{ surface, page, blockId, blockKind }` for context,
- returns `ops` for the translated strings,
- writes `prague-strings/overlays/v1/<chunk>/<locale>.ops.json` with `baseFingerprint`.

### 3) Validate

The build script (or CI step) validates:

- allowlists are well-formed
- overlays are well-formed
- overlay paths are allowlisted
- overlay `baseFingerprint` matches current base
- every base chunk has a valid allowlist (by blockKind)
- locale tokens are normalized (e.g., `es-mx` → `es`) using shared locale rules

### 4) Compile outputs (required)

- Apply overlays during build to produce `prague-strings/compiled/v1/<locale>/**.json`.
- Runtime reads compiled outputs only; overlays remain the source-of-truth translation artifact.

## Runtime / Site Consumption

Prague should consume strings by:

- loading compiled per-locale outputs from `prague-strings/compiled/v1/<locale>/**.json` for each route,
- reading page files shaped as `{ v: 1, blocks: { [blockId]: { strings } } }`,
- avoiding runtime overlay application,
- failing the build if any overlay is missing or stale.

## Manifest Discipline (Deterministic)

The manifest is derived **after** overlays are written:

- build step order: `generate overlays → validate → write manifest`
- no partial manifests; manifest is always a full snapshot of the repo state

## Decisions (Locked)

- Naming: use `prague-strings/` at repo root.
- Scope: Prague strings localization is separate from instance localization.
- Build: compile per-locale outputs during build; runtime reads compiled outputs only.
- Allowlists: semantics match instance allowlists (wildcards, arrays).
- Shared strings: merged first as fallback; any key collision fails validation.
- Deprecation: remove `scripts/prague-localize.mjs` and `.locales/` overrides.

## Policy: Missing or Stale Locales

Strict only:

- if locale != EN and overlay missing or stale, fail build or route generation
- no soft fallback in Prague

## Observability

Every San Francisco localization job should emit:

- `surface`, `kind`, `chunkKey`, `locale`
- `provider`, `model`
- `baseFingerprint`, `baseUpdatedAt`
- `promptVersion`, `policyVersion`

This enables auditing and regression checks at scale.

## How This Scales (100×100×100×100×100)

Define axes:

- $W$ widgets
- $P$ pages
- $L$ locales
- $B$ blocks per page
- $S$ strings per block

The system scales because:

1) **Chunking isolates change**
   - Work is proportional to number of changed chunks, not total string volume.

2) **Fingerprint gating makes it incremental**
   - If a chunk’s fingerprint didn’t change, its overlays remain valid.

3) **Parallelism is trivial**
   - Jobs are independent per `(chunk, locale)`.

4) **Deterministic outputs keep builds cheap**
   - Prague reads local files; no runtime translation calls.

Cost is closer to:

- Worst-case: $\#jobs \approx (\#chunks) \times (L-1)$
- Typical-case: $\#jobs \approx (\#changedChunks) \times (L-1)$

The “100×” case stays manageable if we keep chunks small and only regenerate overlays for the chunks that changed.

## Why This Avoids TS-as-Content

- Strings live only in `prague-strings/base/**.json`.
- Translations live only as overlay files in `prague-strings/overlays/**.ops.json`.
- TS/JS exists only to:
  - compute fingerprints
  - validate allowlists and overlays
  - apply ops
  - generate manifest and compiled outputs

## Execution Plan

### Phase 0 — Scope lock

- Lock decisions: `prague-strings/` naming, strict-only policy, build-time compilation, shared strings merge rule.
- Finalize locale list and base chunk conventions.

### Phase 1 — Data model & repo layout

- Create `prague-strings/` structure (base/allowlists/overlays/manifest).
- Define JSON schemas and versioning for base, overlay, and manifest.
- Implement base fingerprinting + allowlist validation utilities in `scripts/`.

### Phase 2 — San Francisco localization agent

- Add a dedicated Prague strings localization job path (system/OpenAI only).
- Enforce job contract fields and write audit logs.
- Secure auth for local + cloud-dev usage.

### Phase 3 — Build-time pipeline

- Implement `scripts/prague-strings/*` to extract allowlisted strings and call San Francisco.
- Write overlays and validate baseFingerprint + allowlist compliance.
- Generate manifest after overlays as a deterministic snapshot.
- Add `pnpm prague:strings:watch` for local auto-translate + compile when base/allowlists/overlays change.

### Phase 4 — Prague runtime integration

- Add a build-time compiler (in `scripts/` or `prague/src/lib`) to resolve base + overlays + shared strings into compiled outputs.
- Update Prague to read compiled outputs only (no runtime overlay application).
- Enforce strict mismatch errors for missing/stale overlays during compile.
- Wire pages/components to the new strings loader; remove `.locales` usage.

### Phase 5 — Content migration

- Move strings out of `tokyo/widgets/*/pages/*.json` into `prague-strings/base/**`.
- Keep layout JSON as structure-only; ensure block ids are stable.

### Phase 6 — Validation & CI gates

- Add a hard check that every base chunk has overlays for all locales.
- Fail build if missing/stale; add a manifest integrity check task.

### Phase 7 — Deprecation & cleanup

- Remove `scripts/prague-localize.mjs` and `.locales/` usage.
- Update docs and runbooks; verify no TS/JS embeds strings.

### Phase 8 — Rollout

- Run pipeline locally, then in cloud-dev.
- Verify Prague pages render across locales (hero/FAQ/home).
- Record audit artifacts for traceability.
