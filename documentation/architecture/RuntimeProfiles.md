# Local Runtime

`bash scripts/dev-up.sh` is the canonical local boot.

It does one thing:
- start the local DevStudio operating lane
- seed required local platform state
- verify the local stack and internal-tool surfaces before finishing

Local boot topology:
- Bob: `http://localhost:3000`
- Berlin: `http://localhost:3005`
- Tokyo CDN stub: `http://localhost:4000`
- DevStudio: `http://localhost:5173`
- Tokyo-worker: `http://localhost:8791`

There are no alternate local runtime modes behind `dev-up`. Local development should not require developers to reason about multiple boot topologies behind one script.

Rules:
- `dev-up` is one-command local boot.
- `dev-up` exists to make the local DevStudio operating lane usable.
- Local DevStudio runs alongside local Bob + local Tokyo, but it does not host the removed widget-authoring lane.
- Local theme mutation tools (`/api/themes/*`) are local DevStudio tools, not a separate runtime mode feature.
- If local platform state is missing or invalid, `dev-up` fails loudly during seeding instead of pretending the stack is healthy.
- Explicit rerun commands remain available only for debugging:
  - `pnpm dev:seed:platform`
