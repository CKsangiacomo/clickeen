# Clickeen Widget Platform

This repo contains the full Clickeen widget platform:

- **bob/** — Widget editor (Next.js). Consumes precompiled widget panels and hydrates Dieter components.
- **admin/** — DevStudio tooling and component showcase (Vite). Hosts the widget workspace page that embeds Bob.
- **dieter/** — Design system (tokens, CSS, web components). Built assets are served from **tokyo/**.
- **tokyo/** — Local CDN stub serving Dieter assets and built widgets.
- **paris/** — API service used by Bob/Roma/DevStudio for identity, policy, and instance data.
- **roma/** — Product shell app (workspace domains + Builder orchestration into Bob).
- **documentation/** — Platform and architecture notes.

## Architecture (high level)

1) **Widgets live in Tokyo**
   - Each widget has `tokyo/widgets/<name>/spec.json` and built assets (`widget.html/css/js`).
   - Dieter component stencils/specs live under `tokyo/dieter/components`.

2) **Server-side expansion**
   - Bob’s compile API (`/api/widgets/[widgetname]/compiled`) reads the widget spec and expands `<tooldrawer-field>` using Dieter templates/specs.
   - Icons are inlined server-side; compiled panels include final HTML plus deterministic Dieter assets (CSS/JS).

3) **Host surface (DevStudio / Roma) → Bob flow**
   - Host app fetches instance data from Paris and compiled payload from Bob’s compile API.
   - Host posts an explicit `ck:open-editor` message; Bob renders panels, hydrates Dieter controls, and binds state.

4) **Stage vs Pod fills**
   - Appearance panel exposes two dropdown-fill controls: `stage.background` (workspace backdrop) and `pod.background` (widget surface). Both use Dieter dropdown-fill.

## Development

```bash
pnpm install
pnpm build:dieter       # builds Dieter into tokyo/dieter
./scripts/dev-up.sh     # starts Tokyo (4000), Tokyo Worker (8791), Paris (3001), Venice (3003), Bob (3000), Roma (3004), DevStudio (5173), Prague (4321), Pitch (8790), (+ SF 3002 when enabled)
```

To force a full workspace rebuild before starting dev servers:

```bash
./scripts/dev-up.sh --full
```

Useful scripts:
- `pnpm dev:bob`, `pnpm dev:roma`, `pnpm dev:admin`, `pnpm dev:paris`, `pnpm dev:venice`
- `pnpm build` (after `pnpm build:dieter`)
- `pnpm lint`, `pnpm typecheck`, `pnpm test`

## Notes

- Bob runs fully client-side rendering of already-expanded panels; no runtime template fetching.
- Icons must exist in `tokyo/dieter/icons/icons.json`; missing icons fail compilation.
- Widget data paths: `stage.background` and `pod.background` are the canonical fill keys.

## License

Internal Clickeen codebase.
