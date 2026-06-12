# Clickeen Widget Platform

This repo contains the full Clickeen widget platform:

- **bob/** — Widget editor (Next.js). Consumes precompiled widget panels and hydrates Dieter components.
- **admin/** — DevStudio tooling and component showcase (static Cloudflare Pages bundle). Internal toolbench for remote verification and internal tools.
- **dieter/** — Design system (tokens, CSS, web components). Built assets are served from **tokyo/**.
- **tokyo/** — Built Dieter/widget/Prague deploy assets for Tokyo R2.
- **roma/** — Product shell app (workspace domains + Builder orchestration into Bob).
- **documentation/** — Platform and architecture notes.

## Architecture (high level)

1) **Widgets live in Tokyo**
   - Each widget has `tokyo/product/widgets/<name>/spec.json` and built assets (`widget.html/css/js`).
   - Dieter component stencils/specs live under `tokyo/product/dieter/components`.

2) **Server-side expansion**
   - Bob’s compile API (`/api/widgets/[widgetname]/compiled`) reads the widget spec and expands `<tooldrawer-field>` using Dieter templates/specs.
   - Icons are inlined server-side; compiled panels include final HTML plus deterministic Dieter assets (CSS/JS).

3) **Host surface (Roma / Prague MiniBob) → Bob flow**
   - Host app fetches the instance payload through its owner-correct route and the compiled payload from Bob’s compile API.
   - Host posts an explicit `ck:open-editor` message; Bob renders panels, hydrates Dieter controls, and binds state.

4) **Stage vs Pod fills**
   - Appearance panel exposes two dropdown-fill controls: `stage.background` (workspace backdrop) and `pod.background` (widget surface). Both use Dieter dropdown-fill.

## Development

```bash
pnpm install
pnpm build:dieter       # builds Dieter into tokyo/product/dieter
pnpm build              # builds workspace packages
```

Useful scripts:
- `pnpm dev:roma`, `pnpm dev:prague`
- `pnpm build:bob`, `pnpm build:roma`, `pnpm build:devstudio`
- `pnpm build` (after `pnpm build:dieter`)

## Notes

- Bob runs fully client-side rendering of already-expanded panels; no runtime template fetching.
- Icons must exist in `tokyo/product/dieter/icons/icons.json`; missing icons fail compilation.
- Widget data paths: `stage.background` and `pod.background` are the canonical fill keys.

## License

Internal Clickeen codebase.
