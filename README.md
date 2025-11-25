# Clickeen Widget Platform

This repo contains the full Clickeen widget platform:

- **bob/** — Widget editor (Next.js). Consumes precompiled widget panels and hydrates Dieter components.
- **admin/** — DevStudio tooling and component showcase (Vite). Hosts the widget workspace page that embeds Bob.
- **dieter/** — Design system (tokens, CSS, web components). Built assets are served from **denver/**.
- **denver/** — Local CDN stub serving Dieter assets and built widgets.
- **paris/** — API service used by DevStudio for instances.
- **documentation/** — Platform and architecture notes.

## Architecture (high level)

1) **Widgets live in Denver**
   - Each widget has `denver/widgets/<name>/spec.json` and built assets (`widget.html/css/js`).
   - Dieter component templates/specs live under `denver/dieter/components`.

2) **Server-side expansion**
   - Bob’s compile API (`/api/widgets/[widgetname]/compiled`) reads the widget spec and expands `<tooldrawer-field>` using Dieter templates/specs.
   - Icons are inlined server-side; compiled panels include final HTML plus deterministic Dieter assets (CSS/JS).

3) **DevStudio → Bob flow**
   - DevStudio fetches instances from Paris, then fetches the compiled widget from Bob’s API.
   - DevStudio posts the compiled payload to Bob via `postMessage`; Bob renders panels, loads Dieter assets, hydrates, and binds state.

4) **Stage vs Pod fills**
   - Appearance panel exposes two dropdown-fill controls: `stage.background` (workspace backdrop) and `pod.background` (widget surface). Both use Dieter dropdown-fill.

## Development

```bash
pnpm install
pnpm build:dieter       # builds Dieter into denver/dieter
./scripts/dev-up.sh     # starts Denver (4000), Paris (3001), Bob (3000), DevStudio (5173)
```

Useful scripts:
- `pnpm dev:bob`, `pnpm dev:admin`, `pnpm dev:paris`, `pnpm dev:venice`
- `pnpm build` (after `pnpm build:dieter`)
- `pnpm lint`, `pnpm typecheck`, `pnpm test`

## Notes

- Bob runs fully client-side rendering of already-expanded panels; no runtime template fetching.
- Icons must exist in `denver/dieter/icons/icons.json`; missing icons fail compilation.
- Widget data paths: `stage.background` and `pod.background` are the canonical fill keys.

## License

Internal Clickeen codebase.
