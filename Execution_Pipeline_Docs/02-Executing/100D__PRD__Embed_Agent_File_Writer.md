# PRD 100D - Embed Agent File Writer

Status: Executing  
Owner: Product + Engineering  
Date: 2026-05-16  
Parent: `100__PRD__Static_Public_Embed_Delivery.md`

## Purpose

Build the file-writing slice of the PRD 100 embed agent.

The embed agent turns one account-owned instance source package into browser files stored directly in that instance folder:

```text
accounts/{accountPublicId}/instances/{instanceId}/
  instance.json
  overlays/
  index.html
  styles.css
  script.js
  ...
```

The goal is static public delivery. Visitor views must load generated HTML/CSS/JS from `clk.live` and must not require Venice, Roma, Bob, or internal Tokyo config endpoints to assemble the widget per request.

## Scope

In scope:

- Read one instance source package from `accounts/{accountPublicId}/instances/{instanceId}/instance.json`.
- Read required overlay value maps from `accounts/{accountPublicId}/instances/{instanceId}/overlays/`.
- Read widget software and contracts from `product/widgets/{widgetType}/`.
- Generate browser-ready files for the instance.
- Write generated browser files directly under `accounts/{accountPublicId}/instances/{instanceId}/`.
- Write readiness and failure status back into `instance.json` for Roma Widgets.
- Preserve the last successful public output until a replacement output is fully written.

Out of scope for this slice:

- Provisioning `clk.live`.
- Defining the final `instance.json` schema beyond fields this writer must consume or update.
- Translating content or creating overlays.
- Reworking the account asset library contract.
- Removing old Venice runtime composition routes.

## Inputs

Required job inputs:

- `accountPublicId`
- `instanceId`
- saved `instance.json` version or revision marker
- widget software version intended for the build
- target build reason: save, retry, or product widget software rebuild

Required storage inputs:

- `accounts/{accountPublicId}/instances/{instanceId}/instance.json`
- required overlay files under `overlays/`
- widget software/contracts under `product/widgets/{widgetType}/`:
  - `spec.json`
  - `widget.html`
  - `widget.css`
  - `widget.client.js`
  - optional widget-local runtime helpers
  - `agent.md`

The writer must validate that `accountPublicId`, `instanceId`, `widgetType`, base locale, enabled locales, saved config, required locale overlay references, `embedBuildShape`, and widget software version are present and internally consistent before writing public output.

## Outputs

The writer creates or replaces only generated browser files under:

```text
accounts/{accountPublicId}/instances/{instanceId}/
```

Required base files:

- `styles.css`
- `script.js`
- `index.html`

Optional files:

- other explicitly generated browser files required by the selected widget software and `embedBuildShape`

Rules:

- No `embed/` subfolder.
- No `public/` copy.
- No promotion namespace.
- No generated top-level `config.json`, `publish.json`, `embed.json`, `translations.json`, or runtime ingredient JSON.
- No public copy of `instance.json` or `overlays/`.
- Generated files must be browser files, not hidden product state.

## Build Shape Handling

The writer consumes `instance.json.embedBuildShape` as the bounded build decision record.

Supported shape values are the PRD 100 values:

- `rendering`: `html` or `iframe`
- `seoMode`: `off`, `lite`, or `full`
- `locales`: base locale plus enabled target locales
- `clientSide`: `static`, `minimal-js`, or `interactive`

The writer must not infer a different build shape from URL parameters, public requests, widget type guesses, or account lookups.

Build shape effects:

- `rendering` decides whether the generated entry is direct widget HTML or an iframe-oriented shell.
- `seoMode` decides whether SEO/GEO content is generated into browser files.
- `locales` decides which locale-dependent files or in-file locale payloads are needed.
- `clientSide` decides whether `script.js` is empty/minimal, behavior-only, or interactive runtime code.

If the widget software cannot support the requested shape, the job fails and records a status error in `instance.json`; it must not silently downgrade into a different public output.

## File Write Semantics

The entry file is the public availability switch:

```text
accounts/{accountPublicId}/instances/{instanceId}/index.html
```

The writer must preserve this invariant:

```text
old public output keeps serving until new output is fully written
```

Write order:

1. Mark the matching build as `building` in `instance.json`.
2. Generate files from a single consistent input set.
3. Write support files first: CSS, JS, and any other generated browser files referenced by the new entry HTML.
4. Verify the written support files exist and match the generated file list.
5. Write or rename `index.html` last.
6. Mark the matching build as `ready` in `instance.json`.

If storage provides atomic rename/copy semantics, stage the new entry file and rename/copy it to `index.html` last. If the storage API only supports object writes, write all support files first and write the final `index.html` object last.

Failure rules:

- A failed build must not remove or overwrite the last known good `index.html`.
- An older job must not mark a newer saved `instance.json` version as ready.
- Partial support files from a failed build may remain only if they are not referenced by the current public `index.html`; cleanup can remove them later.
- Unpublish is not implemented by this writer. Normal failed builds do not unpublish.

## Asset Reference Rules

Generated output may reference account-owned assets, but must not duplicate them.

The writer must:

- consume account asset references already saved in `instance.json`
- resolve those references through the one Roma/Tokyo account asset library contract
- emit browser URLs that point at the account asset serving contract
- keep account assets under `accounts/{accountPublicId}/assets/`

The writer must not:

- copy account asset files into the instance folder
- mint asset IDs
- invent public asset URLs
- hash asset files
- create blob folders or version folders
- validate uploads, scan files, rename files, or manage the account asset library
- treat Clickeen-owned product media as account assets

In-place replacement of an account asset must keep the same account asset reference and must not require this writer to rebuild every referencing instance.

## Locale Rules

The writer builds the base locale from `instance.json` and saved config.

Locale-dependent output must wait for required overlays:

- If `embedBuildShape.locales` contains only the base locale, no translation overlay is required.
- If target locales are requested, the writer must require the corresponding locale overlay value maps under `overlays/`.
- Missing required overlays are a build-blocking condition, not a reason to generate stale or base-language locale output.
- Overlay bodies are exact value maps. The writer applies them as `baseConfig + one overlayValues` for the target locale.
- The writer must not create overlays, repair overlays, infer translated values, or read a separate translations folder.

When locale-dependent output is blocked, `instance.json` status must show a non-ready state with an overlay-blocked reason instead of reporting ready.

## Status Writes

Roma Widgets reads embed readiness from `instance.json`.

The writer must update the schema fields finalized by PRD 100B/100C with these semantics:

- status: not_generated, queued, building, ready, stale, failed, or unavailable
- saved source version/revision the build describes
- widget software version used by the build
- generated file list for the last successful build
- build start and finish timestamps
- failure code/message when failed
- blocking reason when the build is queued, building, or failed because required overlays are missing

Status writes must be compare-and-set against the saved `instance.json` version or equivalent revision marker.

Required guard:

```text
job may write ready only if job.sourceVersion == current instance.json sourceVersion
```

If a newer save exists, the job may record an ignored/stale job result in job logs, but it must not mark the instance ready.

## Out of Scope

- Runtime rendering, resolving, or overlay application on visitor requests.
- Venice per-view composition.
- Roma, Bob, Berlin, Michael, or San Francisco calls from generated visitor-facing code.
- Generic artifact platform work beyond widget instance mini-sites.
- Account asset upload UI or asset library storage redesign.
- Translation generation.
- Public serving allowlist implementation.
- Cache purge and CDN policy implementation, except preserving write order so cache references are safe.

## Acceptance Criteria

- Given a valid base-locale instance, the writer produces `index.html`, `styles.css`, and `script.js` directly under `accounts/{accountPublicId}/instances/{instanceId}/`.
- The generated `index.html` references only support files that exist before `index.html` is written.
- No `embed/`, `public/`, promotion namespace, copied public folder, or extra top-level runtime JSON is created.
- Generated visitor-facing files do not call Venice, Roma, Bob, or internal Tokyo config endpoints per view.
- Generated files do not fetch `instance.json`, `overlays/`, widget source files, or internal config JSON on visitor view.
- Account assets are referenced through the account asset library contract and are not copied into the instance folder.
- Target-locale output is not marked ready until required overlays exist and have been applied.
- Failed builds preserve the last successful public `index.html`.
- `instance.json` records readiness for Roma Widgets and prevents stale jobs from marking newer saves ready.
- The last successful build records the widget software version used.

## Implementation Notes

- Implement the writer as a San Francisco-managed production job, not a UI helper or loose script.
- Treat the instance folder as the only output root.
- Keep generated file names deterministic for a given input set so cache behavior and cleanup are predictable.
- Prefer relative references between generated browser files, such as `./styles.css` and `./script.js`.
- Keep widget source reads in the product plane; do not copy widget software into account instance folders.
- Validate public-file eligibility before writing. Only browser-safe generated files should be written where `clk.live` may expose them.
- The writer may keep detailed job logs outside the public instance folder, but must not create new instance-level truth outside `instance.json`.

## Risks/Guards

- **Partial deploy:** write support files before `index.html`; preserve old entry on failure.
- **Stale job overwrite:** compare against the current `instance.json` source version before ready status writes.
- **Runtime regression:** generated code must be scanned for forbidden service calls and internal config fetches.
- **Asset duplication:** tests must reject copied files from `accounts/{accountPublicId}/assets/` into the instance folder.
- **Locale drift:** missing overlays must block locale-dependent output and record an overlay-blocked reason.
- **Widget software drift:** status must record the widget software version used so Roma Widgets can show stale builds.
- **Folder drift:** tests must fail if output appears in `embed/`, `public/`, `published/`, or another promotion namespace.

## Validation/Tests

Unit tests:

- validates required input fields and rejects malformed account/instance coordinates
- rejects unsupported or inconsistent `embedBuildShape`
- blocks locale-dependent builds when required overlays are missing
- applies exactly one overlay value map over base config for each target locale
- rejects generated output containing forbidden internal service URLs or config endpoint calls
- rejects asset copy attempts into the instance folder

Integration tests:

- runs a base-locale build and asserts direct instance-folder output
- runs a multi-locale build after overlays exist and asserts ready status
- simulates missing overlay files and asserts non-ready status with an overlay-blocked reason without replacing `index.html`
- simulates an older job finishing after a newer save and asserts it cannot mark ready
- simulates support-file write failure and asserts existing public output remains available
- verifies generated entry HTML references only files written before entry publication

CI guards:

- search generated output fixtures for Venice/Roma/Bob/internal Tokyo config endpoint references
- assert no generated browser files are written under `embed/`, `public/`, or promotion namespaces
- assert no generated top-level JSON state files are emitted beside `instance.json`

## Rollout/Cutover

1. Land the writer behind the PRD 100 static embed generation path.
2. Enable it for internal/admin test instances first.
3. Compare generated output against Bob preview and existing static fixture expectations.
4. Enable save-triggered builds for pre-GA account instances.
5. Let old successful output keep serving while rebuilds run.
6. After `clk.live` serving is validated, route copied embed code to `https://clk.live/{accountPublicId}/{instanceId}`.
7. Coordinate with the Venice-removal slice so old request-time composition is deleted, blocked, or left only as explicit dev-only scaffolding.
