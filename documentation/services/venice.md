# System: Venice - Public Embed Runtime

STATUS: REFERENCE - MUST MATCH PRD 098

Venice is the public iframe/embed runtime. It serves published Clickeen widget instances from Tokyo only.

Venice does not read Supabase, does not know account membership, and does not repair missing widget bytes.

## Routes

- `GET /widget/{instanceId}` - public iframe shell.
- `GET /embed/latest/loader.js` - current loader alias.
- `GET /embed/v2/loader.js` - compatibility v2 loader alias.
- `GET /embed/v2.0.0/loader.js` - immutable versioned loader.
- `GET /embed/v2.0.0/seo-geo-loader.js` - immutable versioned SEO/GEO enhancement loader.
- `GET /widgets/**` - Tokyo widget runtime proxy.
- `GET /dieter/**` - Tokyo Dieter asset proxy.
- `GET /renders/widgets/{instanceId}/live/r.json` - Tokyo published render pointer proxy.
- `GET /renders/widgets/{instanceId}/config.json` - Tokyo published config pack proxy.
- `GET /renders/widgets/{instanceId}/overlays/{overlayId}.json` - Tokyo published overlay object proxy.
- `GET /renders/widgets/{instanceId}/meta/live/{locale}.json` - Tokyo published SEO/GEO meta pointer proxy.
- `GET /renders/widgets/{instanceId}/meta/{locale}/{metaFp}.json` - Tokyo published SEO/GEO meta pack proxy.

Proxy routes use explicit shape allowlists:

- `/widgets/**` allows current widget runtime contracts only: widget root assets, widget-local `widget.*.js` helpers, shared runtime JS/CSS, and base assets.
- `/dieter/**` allows the Dieter manifest, token CSS, icon catalog/SVGs, and component asset files.
- `/renders/**` allows only published render, overlay, and SEO/GEO serving shapes.

Deleted routes:

- legacy short embed route with the single-letter `e` prefix
- legacy short render route with the single-letter `r` prefix
- pre-GA embed-loader compatibility route
- pre-GA tracking compatibility endpoint
- `/api/instance/{id}`

## Identity

`instanceId` is the only public widget instance identity. It is stable, generated, locale-free, and uses Tokyo-worker's compact 10-character uppercase base36 instance ID format.

Examples use compact instance IDs such as `A1B2C3D4E5`, not widget names, display names, UUIDs, or old `ins_*` strings.

## How Venice Serves A Widget

For `/widget/{instanceId}`:

1. Fetch Tokyo published render pointer: `/renders/widgets/{instanceId}/live/r.json`.
2. Resolve the effective locale from query or published locale policy. A non-base locale is usable only when the pointer references a published overlay ID for that language.
3. Fetch the published config from Tokyo.
4. If the effective locale is not the base locale, fetch the selected published overlay object from `/renders/widgets/{instanceId}/overlays/{overlayId}.json` and apply its `{ values }`.
5. Fetch widget runtime HTML from Tokyo: `/widgets/{widgetType}/widget.html`.
6. Bootstrap `window.CK_WIDGET`.

If any required published file is missing, Venice shows a clear unavailable state. It never uses draft/saved account data.

## Embed Snippets

Inline loader:

```html
<script
  src="https://venice.dev.clickeen.com/embed/latest/loader.js"
  async
  data-instance-id="A1B2C3D4E5"
></script>
```

Placeholder loader:

```html
<div data-clickeen-id="A1B2C3D4E5"></div>
<script src="https://venice.dev.clickeen.com/embed/latest/loader.js" async></script>
```

Scriptless iframe:

```html
<iframe src="https://venice.dev.clickeen.com/widget/A1B2C3D4E5" loading="lazy"></iframe>
```

## Cache Rules

- `/widget/{instanceId}`: short cache.
- `/embed/latest/loader.js` and `/embed/v2/loader.js`: short compatibility cache.
- `/embed/v2.0.0/loader.js`: immutable versioned cache.
- `/embed/v2.0.0/seo-geo-loader.js`: immutable versioned cache.
- Published live pointers: `no-store`.
- Overlay objects: `no-store` through Venice because overlay IDs are version slots, not immutable content hashes.
- Fingerprinted SEO/GEO packs and widget assets: immutable.

This keeps embeds cheap without creating a second source of truth.
