# Documentation — How To Use (and Keep Current)

This folder is the primary knowledge base for working in the Clickeen repo (especially for AI coding agents). It is a **living reference**: it must be updated alongside code changes.

Docs are not a “single source of truth”. When docs and code disagree, debug using runtime code + DB schema + deployed Cloudflare config, then update the docs to match reality.

---

## Structure

- `documentation/CONTEXT.md`
  - Glossary + cross-system concepts + “debugging order”
- `documentation/clickeen-platform-architecture.md`
  - System map, environment model, cross-system data flows
- `documentation/systems/*.md`
  - Per-system details and operational specs (Bob, Paris, San Francisco, Tokyo, etc.)
- `documentation/widgets/*`
  - Widget PRDs, behavior specs, architecture notes
- `documentation/Agents/*`
  - Agent PRDs (Minibob Copilot, etc.)

`CurrentlyExecuting/` is a scratchpad area and may be gitignored; it is not guaranteed to be up to date.

---

## Update Rules (what must be kept in sync)

If you change runtime behavior, update docs in the same PR/commit:

- **New/changed endpoints**
  - Update the owning system doc (`documentation/systems/{system}.md`)
  - Update any cross-system flow diagrams (`documentation/clickeen-platform-architecture.md`)
- **New env vars / Cloudflare bindings**
  - Update the owning system doc + relevant runbooks
  - Never document actual secret values (names only)
- **Build/deploy changes**
  - Update the system doc and any operational runbooks
- **Copilot/AI behavior changes**
  - Update `documentation/Agents/*.md` (UX + contract)
  - Update `documentation/systems/bob.md`, `documentation/systems/paris.md`, `documentation/systems/sanfrancisco*.md` as needed
- **Widget spec/runtime changes**
  - Update the widget PRD under `documentation/widgets/{WidgetName}/`
  - If it affects shared runtime (stage/pod/typography/branding), update `documentation/CONTEXT.md` and architecture docs

---

## “Shipped vs Planned” (prevent drift)

In system docs, keep these separate:

- **Runtime Reality (shipped)**
  - what exists in code and deployed config today
- **Roadmap / Milestones (planned)**
  - what we intend to build next

Avoid mixing planned APIs with shipped ones in the “Quick Scan” sections.

---

## Security rules for docs

- Never commit or paste real secrets into docs (`AI_GRANT_HMAC_SECRET`, API keys, Supabase keys, JWTs, etc.).
- Use placeholders: `<secret>`, `<token>`, `<baseUrl>`, `wgt_...`.
- If an endpoint requires auth, describe the header shape, not the value.

---

## Drift Detection (cheap checks)

- Copilot regression suite (golden set): `pnpm eval:copilot`
- Compiler determinism: `node scripts/compile-all-widgets.mjs`
- Quick grep for removed/renamed surfaces:
  - `rg -n "/api/ai/|/v1/execute|SANFRANCISCO_BASE_URL|AI_GRANT_HMAC_SECRET" documentation`

When drift is found: update docs to match the shipped code/config (don’t block execution on drift).

