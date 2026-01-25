# Documentation — How To Use (and Keep Current)

This folder is the primary knowledge base for working in the Clickeen repo (especially for AI coding agents). It is a **living reference**: it must be updated alongside code changes.

Docs are not a "single source of truth". When docs and code disagree, debug using runtime code + DB schema + deployed Cloudflare config, then update the docs to match reality.

---

## Structure

```
documentation/
├── strategy/                 # WHY — Vision, moats, business model
│   ├── WhyClickeen.md       # Vision, AI-first, strategic moats
│   └── GlobalReach.md       # 100⁵ scale model
│
├── architecture/             # HOW — Platform design, principles
│   ├── CONTEXT.md           # Current state, glossary, what exists
│   ├── Tenets.md            # Architectural principles
│   └── Overview.md          # Platform diagram, data flow
│
├── services/                 # RUNTIME SYSTEMS
│   ├── bob.md               # Editor
│   ├── dieter.md            # Design system
│   ├── devstudio.md         # Internal tools (admin)
│   ├── tokyo.md             # Asset CDN
│   ├── tokyo-worker.md      # Asset uploads + l10n publisher
│   ├── paris.md             # API/database
│   ├── sanfrancisco.md      # AI workforce OS
│   ├── venice.md            # Embed runtime
│   ├── michael.md           # Database schema
│   └── prague/              # Marketing surface
│       ├── prague-overview.md
│       ├── blocks.md
│       └── layout.md
│
├── capabilities/             # CROSS-CUTTING FEATURES
│   ├── supernova.md         # NextGen web design effects
│   ├── seo-geo.md           # SEO/GEO platform
│   ├── localization.md      # i18n + l10n (runtime contract)
│   └── multitenancy.md      # Team/workspace model
│
├── ai/                       # AI ARCHITECTURE
│   ├── overview.md          # San Francisco platform
│   ├── infrastructure.md    # Cloudflare infra
│   ├── learning.md          # How agents learn
│   ├── agents/
│   │   ├── sdr-copilot.md   # SDR Copilot agent
│   │   ├── ux-writer.md     # UX Writer agent
│   │   ├── gtm.md           # GTM agent
│
└── widgets/                  # WIDGET SPECS
    ├── WidgetBuildContract.md # Normative build contract
    ├── WidgetComplianceSteps.md # Execution checklist
    ├── WidgetArchitecture.md # System-level reference
    └── {widget}/            # Per-widget specs
        └── {widget}_PRD.md
```

| Folder | What It Answers |
|--------|-----------------|
| **strategy/** | WHY are we building this? |
| **architecture/** | HOW is it designed? |
| **services/** | WHAT systems run? |
| **capabilities/** | WHAT features span systems? |
| **ai/** | WHO runs the company? (AI workforce) |
| **widgets/** | WHAT do we ship? |

---

## Update Rules (what must be kept in sync)

If you change runtime behavior, update docs in the same PR/commit:

- **New/changed endpoints**
  - Update the owning system doc (`documentation/services/{system}.md`)
  - Update any cross-system flow diagrams (`documentation/architecture/Overview.md`)
- **New env vars / Cloudflare bindings**
  - Update the owning system doc + relevant runbooks
  - Never document actual secret values (names only)
- **Build/deploy changes**
  - Update the system doc and any operational runbooks
- **Copilot/AI behavior changes**
  - Update `documentation/ai/*.md` (UX + contract)
- **Widget spec/runtime changes**
  - Update the widget PRD under `documentation/widgets/{WidgetName}/`
  - If it affects shared runtime (stage/pod/typography/branding), update `documentation/architecture/CONTEXT.md`
- **Capability changes (Supernova, SEO/GEO, multitenancy)**
  - Update `documentation/capabilities/{capability}.md`
- **Prague strings localization pipeline**
  - Update `documentation/capabilities/localization.md` + `documentation/services/prague/*.md`

---

## "Shipped vs Planned" (prevent drift)

In system docs, keep these separate:

- **Runtime Reality (shipped)**
  - what exists in code and deployed config today
- **Roadmap / Milestones (planned)**
  - what we intend to build next

Avoid mixing planned APIs with shipped ones in the "Quick Scan" sections.

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

When drift is found: update docs to match the shipped code/config immediately; treat mismatches as P0 doc bugs.
