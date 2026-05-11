# System: Venice - Public Embed Runtime

STATUS: REFERENCE - MUST MATCH PRD 88 RUNTIME

Venice is the public iframe/embed runtime. It serves published Clickeen widget instances from Tokyo only.

Venice does not read Supabase, does not know account membership, and does not repair missing widget bytes.

## Routes

- `GET /widget/{instanceId}` - public iframe shell.
- `GET /embed/latest/loader.js` - current loader alias.
- `GET /embed/v2/loader.js` - current loader.
- `GET /embed/v1/loader.js` - legacy loader shape that still targets `/widget/{instanceId}`.
- `GET /embed/pixel` - no-op compatibility endpoint.
- `GET /widgets/**` - Tokyo widget runtime proxy.
- `GET /dieter/**` - Tokyo Dieter asset proxy.
- `GET /renders/widgets/**` - Tokyo published render proxy.
- `GET /l10n/widgets/**` - Tokyo published l10n proxy.

Deleted routes:

- legacy short embed route with the single-letter `e` prefix
- legacy short render route with the single-letter `r` prefix
- `/api/instance/{id}`

## Identity

`instanceId` is the only public widget instance identity. It is stable, generated, and locale-free.

Examples use `ins_...`, not widget names or display names.

## How Venice Serves A Widget

For `/widget/{instanceId}`:

1. Fetch Tokyo published render pointer: `/renders/widgets/{instanceId}/live/r.json`.
2. Resolve the effective locale from query or published locale policy.
3. Fetch the published config and l10n overlay/text bytes from Tokyo.
4. Fetch widget runtime HTML from Tokyo: `/widgets/{widgetType}/widget.html`.
5. Bootstrap `window.CK_WIDGET`.

If any required published file is missing, Venice shows a clear unavailable state. It never uses draft/saved account data.

## Embed Snippets

Inline loader:

```html
<script
  src="https://venice.dev.clickeen.com/embed/latest/loader.js"
  async
  data-instance-id="ins_..."
></script>
```

Placeholder loader:

```html
<div data-clickeen-id="ins_..."></div>
<script src="https://venice.dev.clickeen.com/embed/latest/loader.js" async></script>
```

Scriptless iframe:

```html
<iframe src="https://venice.dev.clickeen.com/widget/ins_..." loading="lazy"></iframe>
```

## Cache Rules

- `/widget/{instanceId}`: short cache.
- Published live pointers: `no-store`.
- Fingerprinted packs and widget assets: immutable.

This keeps embeds cheap without creating a second source of truth.
