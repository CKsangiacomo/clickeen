# PRD 100 - Core Instance Mini-Sites And Static Embed Delivery

Status: Executing  
Owner: Product + Architecture  
Date: 2026-05-16  
Parent: PRD 099 - Tokyo R2 Product Storage Architecture Refactor

## Purpose

PRD 099 fixed the Tokyo account storage boundary.

PRD 100 changes what an account-owned instance is.

This is a core product PRD, not an embed-only optimization.

An instance is no longer a set of JSON ingredients that Venice assembles for every visitor. Each instance becomes a tiny generated site: one source JSON for agents, overlay value maps, and built HTML/CSS/JS files that browsers can load directly.

This moves cost from public visitor views to Save-time build work.

```text
Old shape:
  visitor -> Venice -> config + overlay + widget HTML -> computed response

PRD 100 shape:
  Save -> agents build instance mini-site
  visitor -> cached static HTML/CSS/JS
```

This is what makes unlimited normal views economically possible. Views should be CDN/static delivery, not Clickeen compute.

## Product Architecture Bet

Classic widget platforms were built around a runtime service model:

```text
user configures widget
platform stores config
platform runtime renders or loads the widget on every visitor view
```

That model made sense before reliable AI coding agents existed.

The platform needed one generic renderer that could interpret many configs at request time. That also made plan enforcement, view metering, branding, updates, and account control naturally happen through the runtime path.

Clickeen is making a different product bet:

```text
user saves intent/config
agents generate the instance mini-site
Tokyo stores the instance source and build output
public traffic receives cached static files
```

In Clickeen, agents replace runtime interpretation with Save-time production.

The public embed is not a remote-controlled runtime widget. It is a generated mini-site for one instance.

This is the architecture that lets Clickeen offer fast, low-cost, AI-built widgets without pricing normal users by ordinary visitor views.

The cost and complexity move to:

- Save
- translation generation
- embed generation
- public availability file changes
- rebuilds when product widget software changes

They must not move back into every public visitor request.

Therefore PRD 100 defines the surviving product shape for public widgets:

```text
Roma/Bob save source truth -> agents build -> Tokyo/static delivery serves
```

Any implementation that makes Venice or another service render, resolve, decide, or assemble widgets per public view is a regression against the core Clickeen product model.

## Scope Boundary

PRD 100 executes this model for public widget instances only.

It establishes the larger Clickeen production pattern:

```text
atoms/molecules + config + overlays
  -> agents build
  -> cached HTML/CSS/JS artifact
```

That pattern may later apply to other artifact types, such as emails, landing pages, ads, or sites.

Those artifact types are not part of PRD 100.

PRD 100 must not introduce a generic artifact framework before widget instances work correctly.

## Core Product Model

The canonical static embed URL is:

```text
https://clk.live/{accountPublicId}/{instanceId}
```

Example:

```text
https://clk.live/00A1B2C3/AB12CD34EF
```

The URL contains the two coordinates required to serve the instance without a lookup:

- `accountPublicId`
- `instanceId`

`accountPublicId` is the 8-character uppercase base36 account product/storage identity.

Accepted `accountPublicId` format:

```text
^[0-9A-Z]{8}$
```

`instanceId` is the 10-character uppercase base36 instance folder identity under that account.

Accepted `instanceId` format:

```text
^[0-9A-Z]{10}$
```

There is no separate `publicEmbedId`.

There is no runtime URL shortener service.

There is no redirect alias.

There is no second public embed namespace.

A public request for:

```text
https://clk.live/00A1B2C3/AB12CD34EF
```

maps directly to the Tokyo/R2 object:

```text
accounts/00A1B2C3/instances/AB12CD34EF/index.html
```

Supporting browser files use the same direct mapping:

```text
https://clk.live/00A1B2C3/AB12CD34EF/styles.css
  -> accounts/00A1B2C3/instances/AB12CD34EF/styles.css

https://clk.live/00A1B2C3/AB12CD34EF/script.js
  -> accounts/00A1B2C3/instances/AB12CD34EF/script.js
```

The public URL must not expose widget type, locale, overlay IDs, private account UUIDs, private user IDs, or internal service routes.

It intentionally carries `accountPublicId + instanceId` so public serving can be a static path rewrite instead of a lookup.

The browser needs HTML/CSS/JS, not Clickeen internal JSON. Therefore the instance folder must contain generated browser files.

The canonical URL serves the HTML entry file.

Default copied embed code may wrap that URL in an iframe.

If Clickeen offers a script embed, the script `src` must point to a generated JavaScript file such as:

```text
https://clk.live/{accountPublicId}/{instanceId}/script.js
```

The HTML entry URL must not be used as a JavaScript `src`.

## Tokyo Visibility Boundary

The account instance folder is the mini-site storage root for one instance.

This path exists in Tokyo/R2:

```text
accounts/{accountPublicId}/instances/{instanceId}/
```

`clk.live` exposes only an allowlisted static serving view of that folder:

```text
https://clk.live/{accountPublicId}/{instanceId}
  -> accounts/{accountPublicId}/instances/{instanceId}/index.html
```

Public visitors must not be able to request:

- `instance.json`
- files under `overlays/`
- non-browser build inputs
- directory listings for account or instance folders

Allowed public browser files are:

```text
index.html
styles.css
script.js
other explicitly generated browser files required by the mini-site
```

Public serving is a path-template rewrite, not a product lookup:

```text
/{accountPublicId}/{instanceId}/{file?}
  -> accounts/{accountPublicId}/instances/{instanceId}/{file?}
```

If `{file}` is omitted, the serving layer uses `index.html`.

The serving layer must validate path shape and file allowlist. It must not expose raw Tokyo directory browsing.

## Media vs Assets Naming Boundary

The word `assets` is reserved for account-owned uploads in Tokyo.

That includes normal customer account uploads and uploads owned by the admin account.

Use:

```text
accounts/{accountPublicId}/assets/
```

only for account-owned assets.

Clickeen-owned product files must not be called assets.

Use `media` for Clickeen-owned product files used by Prague, Roma, Bob, Dieter, widget software, marketing surfaces, app UI, product-owned demo images, screenshots, icons, fonts, or similar internal/product-owned files.

The naming rule is:

```text
media   = Clickeen-owned product media
assets  = account-owned uploads in Tokyo
```

PRD 100 must preserve this naming boundary so generated embeds, Tokyo storage, and future agents do not confuse product-owned media with account-owned assets.

## Account-Owned Asset Boundary

This section is only about assets uploaded or owned by an account.

It is not about Clickeen-owned product media used by Prague, Roma, Bob, Dieter, widget software, marketing pages, app UI, or internal product surfaces.

Account-uploaded assets live under the account storage boundary:

```text
accounts/{accountPublicId}/assets/...
```

PRD 100 must not create a second identity system for account-owned assets.

PRD 100 does not introduce a second public asset namespace, asset blob versioning, hash folders, or immutable asset histories.

The product need is simpler: when a user uploads a JPG, that account asset lives in the account's `assets/` folder and the system finds it there.

The intended product model is an account asset library, not a blob registry.

Roma is the account asset library surface.

For PRD 100, Roma must support the account asset library actions needed by widget authoring: upload, list, replace, delete, and reuse from Bob controls.

Richer organization such as folders and bulk library management can evolve later without changing the asset authority.

Instances reference account assets.

Instances do not own account assets.

Generated instance output must reference account assets from the account library. It must not duplicate account asset files into the instance folder or turn account assets into instance-owned files.

In-place replacement of an account asset keeps the same account asset reference and must not require rebuilding instances that reference it.

The asset identity must be understandable as account-owned library state. It must not require the embed agent to understand hash folders, blob internals, immutable histories, or generated public asset identifiers.

The embed agent must not manage account-owned assets.

The embed agent must not mint asset IDs, invent public asset URLs, hash files, create blob folders, version assets, or decide account asset serving.

If generated HTML/CSS/JS needs to reference an account-owned asset, it must consume the account asset reference already saved in `instance.json` and resolve it through the one Roma/Tokyo account-asset contract.

PRD 100 does not make the embed agent an asset manager.

However, code audit found that the current Roma/Tokyo account-asset contract is not yet the intended simple account library shape.

Current implementation drift:

- uploaded assets are identified by generated UUID `assetId`
- bytes are stored under an internal `blob/` segment
- metadata is stored in per-asset `manifest.json`
- `sha256` is recorded as asset metadata
- resolved URLs are built from `accountPublicId`, `assetId`, and filename

That current shape is implementation reality, not product truth for PRD 100.

Slice `100F` must realign the account-owned asset contract with the simpler account asset library model and define the migration/cleanup path for any pre-GA uploaded test assets.

Old implementation shape must not leak into new generated embed architecture.

If a user replaces an asset in the product, Clickeen should update that account-owned asset according to the active account asset library contract.

Changing an asset should not require inventing a new asset storage model unless a later product requirement proves it.

## Account Asset Upload Boundary

Account assets can be uploaded from:

- Bob, when the user is editing a widget and uploads from a control/dropdown/picker
- Roma, when the user manages the account asset library directly

Both paths must write through the same Roma/Tokyo account-asset contract.

Bob upload is only an entry point.

Roma asset management is only an entry point.

They must not create separate asset truths.

Once accepted, the uploaded file belongs to:

```text
accounts/{accountPublicId}/assets/
```

The account asset library must stay synced between Bob and Roma.

If a user uploads an asset in Bob, Roma must be able to show it in the account asset library.

If a user manages, replaces, renames, or organizes an asset in Roma, Bob must use the same account asset truth when editing widgets.

Asset validation happens at the upload boundary before a file becomes an account asset.

Minimum validation:

- normalize unsafe names into product-safe names
- reject path traversal and absolute paths
- reject control characters and invalid folder/file names
- enforce allowed file extensions and MIME/type checks
- enforce size limits
- reject executable or scriptable uploads
- scan or quarantine files before acceptance when scanner infrastructure is available

Only accepted files are written into the account `assets/` folder.

The embed agent must treat account assets as already accepted product objects. It must not perform upload validation, malware scanning, renaming, or asset library management.

## Instance Folder As Mini-Site

Every account-owned instance lives at:

```text
accounts/{accountPublicId}/instances/{instanceId}/
```

After PRD 100, that folder is shaped as:

```text
accounts/{accountPublicId}/instances/{instanceId}/
  instance.json
  overlays/
  index.html
  styles.css
  script.js
  ...
```

There is one top-level JSON document:

```text
instance.json
```

There are no sibling `config.json`, `publish.json`, `embed.json`, `translations.json`, or other top-level state JSON documents.

The rest of the folder is:

- `overlays/` for overlay value maps
- generated browser files for the public mini-site

## `instance.json`

`instance.json` is the source package for agents and product operations.

It is the one JSON document that the translation agent and embed agent read.

It owns:

- `accountPublicId`
- `instanceId`
- `widgetType`
- display metadata
- saved config
- base locale
- enabled target locales
- product-approved embed capabilities for this instance
- embed build shape
- embed build status for Roma Widgets
- translation/overlay generation status if needed for Roma Widgets
- source widget software version used by the last successful embed build

`embedBuildShape` is the bounded build decision record for the embed agent.

It must be explicit in `instance.json` instead of inferred differently by multiple services.

Base shape:

```json
{
  "embedBuildShape": {
    "rendering": "html",
    "seoMode": "off",
    "locales": ["en"],
    "clientSide": "minimal-js"
  }
}
```

Allowed values:

- `rendering`: `html` or `iframe`
- `seoMode`: `off`, `lite`, or `full`
- `locales`: base locale plus enabled target locales
- `clientSide`: `static`, `minimal-js`, or `interactive`

The values are set by product policy, widget type, account capabilities, and saved instance settings. Public requests do not choose or override them.

`instance.json` is not served to public visitors as the widget.

Public visitors receive generated browser files from the same instance folder through the `clk.live` static serving view.

## `overlays/`

Translations are overlays.

Overlay files live under:

```text
overlays/
```

An overlay is a value map used by agents/builders to produce locale or variant output.

There is no separate translation content folder.

The embed agent may read `instance.json` plus `overlays/` to generate localized static files.

## Generated Browser Files

The generated browser files in the instance folder are the built mini-site for the instance.

It contains the files a browser needs:

- HTML
- CSS
- JS
- generated browser files or references to account assets

Base example:

```text
accounts/{accountPublicId}/instances/{instanceId}/
  instance.json
  overlays/
  index.html
  styles.css
  script.js
```

Locale/mode output can live under the instance folder as generated browser files when needed, but those are still browser files, not runtime JSON ingredients.

The public copied URL:

```text
https://clk.live/{accountPublicId}/{instanceId}
```

must serve generated static files through a direct path-template rewrite without Venice composing or resolving the instance.

The embed agent writes the mini-site browser files under the instance folder.

There is no separate public copy.

There is no promotion into a second namespace.

`clk.live` is the public static serving view of allowlisted browser files in the account instance folder.

## Save Flow

Bob edits in browser memory.

On Save:

1. Roma updates `instance.json` with the saved config and current product state.
2. Roma triggers the translation agent.
3. Roma triggers the embed agent.

```text
Save
  -> write instance.json
  -> translation agent writes overlays/
  -> embed agent writes generated browser files
```

Save means the source package is persisted.

Save does not mean every generated embed file is ready.

The user may continue editing in Bob while translation and embed generation are queued or running.

Public serving keeps using the last successfully written `index.html` until a new build is fully written, or until the entry file is removed.

Base embed output may be generated from `instance.json`.

Locale-dependent output must wait for the required overlays.

## Translation Agent

The translation agent reads `instance.json`.

It writes translation output as overlays under `overlays/`.

It does not create a separate translation content model.

## Embed Agent

The embed agent reads:

- `instance.json`
- relevant files under `overlays/`
- widget software/contracts from the product plane

It writes:

```text
index.html
styles.css
script.js
other generated browser files required by the instance
```

The embed agent writes the actual HTML/CSS/JS for the instance.

It handles product-approved build shape:

- SEO/GEO or not
- iframe or not
- base locale
- generated locale files
- current widget client-side needs

Those are build-time decisions. Public requests do not decide them.

The embed agent must not generate public code that calls Venice, Roma, Bob, or internal Tokyo config endpoints on every visitor view.

If overlays for target locales are still being generated, the embed build status in `instance.json` must make that visible. The product must not report a fully ready public embed while required overlay-dependent output is missing.

## Widget Software Rebuild Policy

The embed output is generated from product widget software plus the instance source package.

When product widget software changes, existing public embeds do not recompute on visitor requests.

Existing instances keep serving their last successfully written static output until a rebuild writes new output.

`instance.json` must record the widget software version used by the last successful embed build.

If the current product widget software version is newer than the last built version, Roma Widgets must be able to show the instance as stale relative to widget software.

Rebuilds caused by widget software changes are background San Francisco jobs.

They must be scheduled with bounded concurrency and backpressure. A product widget software change must not create an unbounded simultaneous rebuild of every affected instance.

Customers may trigger a rebuild by saving the instance again. Product policy may also schedule automatic background rebuilds for affected instances.

The rebuild policy must preserve the public-serving rule:

```text
old public output keeps serving until new output is fully written
```

This section is required before Venice request-time composition can be removed, because static embeds must have a defined path for receiving product widget software fixes.

## San Francisco AI Engine Requirement

PRD 100 depends on agents becoming production infrastructure.

San Francisco is the Clickeen AI Engine boundary for this work.

The translation agent and embed agent must be built as San Francisco-managed agents, not as loose scripts, ad hoc calls, or UI-side helpers.

Clickeen is currently subpar on this front.

The existing instance translation path is not reliable enough for PRD 100's overlay model.

Because translations are overlays, failed or inconsistent translation generation means the instance source/build pipeline is incomplete.

PRD 100 must therefore treat San Francisco agent hardening as part of the execution path:

- translation jobs must be queueable, retryable, observable, and tied to one saved `instance.json` version
- embed jobs must be queueable, retryable, observable, and tied to one saved `instance.json` version plus the overlay state they used
- job results must write status back into `instance.json` for Roma Widgets
- failed jobs must not silently mark incomplete output as ready
- agents must have explicit input and output contracts
- agents must not invent new folder structures or extra top-level JSON truth

This does not expand PRD 100 into a full San Francisco rebuild.

It does make one thing non-negotiable: PRD 100 cannot rely on unreliable agent behavior and still claim the instance mini-site model is production-ready.

## Roma Widgets Status

Embed readiness/status belongs in Roma Widgets.

Bob does not own this status.

Roma Widgets reads status from `instance.json` and shows whether the generated mini-site is:

- not_generated
- queued
- building
- ready
- stale relative to the latest saved config
- failed
- unavailable

If an old generated mini-site is already public, it may keep serving while a new build runs.

Roma Widgets must distinguish saved source state from generated public file readiness.

Save can be complete while embed generation is still queued, building, stale, or failed.

Status writes must be tied to the saved `instance.json` version they describe.

An older job must not overwrite a newer save's status as ready.

Minimum status transitions:

```text
not_generated -> queued -> building -> ready
queued/building -> failed
ready -> stale
ready/stale/failed -> queued
any publicly available state -> unavailable
```

## Public Serving

Public serving must be static-file delivery.

The public hostname is:

```text
clk.live
```

It must be provisioned with DNS, TLS, cache policy, and routing to Tokyo/R2 account instance storage.

The serving implementation is Tokyo public static delivery backed by the account instance folder.

Public serving uses this path-template rewrite:

```text
https://clk.live/{accountPublicId}/{instanceId}
  -> accounts/{accountPublicId}/instances/{instanceId}/index.html

https://clk.live/{accountPublicId}/{instanceId}/{file}
  -> accounts/{accountPublicId}/instances/{instanceId}/{file}
```

It may use a thin edge layer for:

- validating the `accountPublicId` and `instanceId` format
- enforcing the public file allowlist
- returning unavailable/404 responses
- serving static files from cache or origin storage
- setting cache headers
- abuse controls that do not render or assemble widgets

That edge layer must not become a renderer, resolver, policy engine, index reader, or account-state reader on normal public views.

It must not:

- run a URL-shortener lookup
- run a `shortId -> accountPublicId + instanceId` lookup
- fetch config JSON
- fetch overlay JSON
- fetch widget HTML
- apply overlays
- run policy checks
- call AI
- call Roma/Bob/Berlin/Michael/San Francisco
- execute Venice render logic

Normal public traffic should hit cached static files.

Venice must not be in the per-view hot path as a renderer or resolver.

Clickeen is pre-GA.

Therefore PRD 100 does not need customer compatibility for old Venice runtime embed routes.

Any old Venice runtime embed route may be deleted, blocked, or replaced as part of PRD 100.

If a Venice route remains during execution, it must be explicitly dev-only scaffolding for local/internal verification.

It must not be preserved for public compatibility.

It must not appear in copied embed code.

It must not define production architecture, account lifecycle behavior, public availability semantics, or public serving.

PRD 100 target state:

```text
public visitor -> clk.live/{accountPublicId}/{instanceId} -> cached static files
```

Not:

```text
public visitor -> Venice -> config/overlay/render decision
```

## View Economics

Because each instance is a mini-site, normal views do not require Clickeen compute.

This supports:

```text
unlimited normal views
```

The product should limit things that actually cost Clickeen materially:

- number of instances
- storage
- editors
- premium build features
- locales
- SEO/GEO
- branding removal

View caps should not be necessary for normal static embed delivery.

Abuse protection is still allowed, but it is not the product pricing model for ordinary views.

## Public Availability Semantics

Public availability is controlled by the physical presence of the entry file.

The public entry file is:

```text
accounts/{accountPublicId}/instances/{instanceId}/index.html
```

The canonical public URL:

```text
https://clk.live/{accountPublicId}/{instanceId}
```

serves that `index.html` file.

If `index.html` exists, the mini-site is publicly available.

If `index.html` does not exist, the public URL returns unavailable/404.

Unpublish is physical:

```text
index.html -> index.html.off
```

Republish is physical:

```text
index.html.off -> index.html
```

No product service is consulted on normal public views.

No Venice route, Roma route, policy check, lookup table, pointer file, or instance index is allowed in the normal public serving path.

The entry file is the visible switch for visitors.

To avoid a visitor receiving new HTML that points to missing support files, generation must write support files first and write/rename `index.html` last.

To unpublish, remove or rename `index.html` first and purge/invalidate the affected `clk.live/{accountPublicId}/{instanceId}` cache entry as needed.

Old generated files that are no longer referenced by the current entry HTML may be retained briefly for cache safety and then garbage-collected.

The required retention policy is:

- keep the current serveable output
- keep enough previous generated embed files to avoid broken cache references during normal CDN TTL windows
- delete unreferenced older generated embed files through scheduled cleanup

## Non-Negotiables

- One top-level `instance.json` per instance.
- No top-level `config.json`.
- No top-level `publish.json`.
- No top-level `embed.json`.
- No `translations/` folder.
- Translations are overlays.
- Browsers receive HTML/CSS/JS, not internal JSON ingredients.
- Venice does not compose widgets for public traffic.
- Because Clickeen is pre-GA, old Venice runtime embed routes do not require customer compatibility.
- The canonical static embed URL is `https://clk.live/{accountPublicId}/{instanceId}`.
- There is no separate `publicEmbedId`.
- There is no short URL alias or redirect service in PRD 100.
- Save triggers agents; editor operations do not.
- Translation and embed agents are San Francisco-managed production agents.
- PRD 100 executes this model for widget instances only.
- Do not introduce a generic artifact platform in PRD 100.
- Public serving is a direct path-template rewrite to account instance storage.
- Public serving exposes only allowlisted generated browser files.
- Public serving must not expose `instance.json`, `overlays/`, non-browser build inputs, or directory listings.
- Generated embeds use account-owned asset references according to one Roma/Tokyo account asset library contract.
- Instance embed output references account assets; it does not own or duplicate account asset files.
- In-place account asset replacement keeps the same account asset reference and must not require instance rebuilds.
- Bob and Roma asset uploads write to the same account asset truth.
- Asset validation happens before files enter `accounts/{accountPublicId}/assets/`.
- Widget software changes require bounded background rebuilds, not request-time recompute.
- Public availability is controlled by `index.html` presence.
- Unpublish renames or removes `index.html` so the public URL stops serving.

## Execution Slices

| Slice | Scope |
| --- | --- |
| `100A` | Instance folder shape, one `instance.json`, Save semantics, and generated-file readiness state |
| `100B` | San Francisco production job contract for translation and embed agents |
| `100C` | Account-owned asset library realignment, upload validation, and in-place replacement |
| `100D` | Embed agent file writer that creates instance mini-site browser files |
| `100E` | `clk.live` static serving, allowlist, cache behavior, and unpublish/republish by `index.html` presence |
| `100F` | Remove Venice runtime composition and add PRD 100 CI guards |

## Done

PRD 100 is done when:

- each instance folder contains the source package and generated mini-site browser files
- there is one top-level `instance.json`
- overlays are stored under `overlays/`
- generated browser files are stored in the instance folder
- Save triggers translation and embed generation
- San Francisco owns reliable translation and embed job execution
- Roma Widgets shows embed readiness from instance state
- copied code uses `https://clk.live/{accountPublicId}/{instanceId}`
- account-owned assets referenced by embeds use one Roma/Tokyo account asset library contract
- Bob and Roma share one synced account asset library
- unsafe asset uploads are rejected before becoming account assets
- public serving is static-file delivery
- widget software changes have a bounded rebuild path
- Venice no longer renders or resolves widgets per public view
