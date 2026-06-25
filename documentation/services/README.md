# Services Operator Manual

STATUS: CURRENT SYSTEM OPERATOR SPEC

This folder documents current runtime services. Each file is an operator manual:
what the service owns, what it must not own, the runtime routes/config it uses,
and how to verify work through the owning surface.

Services in this folder are application, storage, data, design-system, and
public-site surfaces:

| Service | Manual |
| --- | --- |
| Berlin auth/session | `documentation/services/berlin.md` |
| Bob widget editor | `documentation/services/bob.md` |
| DevStudio human cockpit | `documentation/services/devstudio.md` |
| Dieter design system | `documentation/services/dieter.md` |
| Michael Supabase/Postgres | `documentation/services/michael.md` |
| Prague marketing site | `documentation/services/prague/prague-overview.md` |
| Roma account app | `documentation/services/roma.md` |
| Tokyo R2/static deploy contract | `documentation/services/tokyo.md` |
| Tokyo-worker R2 boundary | `documentation/services/tokyo-worker.md` |

AI execution systems live in `documentation/ai/`, not here. San Francisco,
Ombra, Learning, Product Copilot, Translation Agent, and planned agents are
documented there because their primary authority is AI operation, not product
surface storage or UI.

`documentation/services/prague/` is nested because Prague has several local
operator contracts: overview, section registry, layout, and copy style. Prague
is still one service.

Do not put planning docs, withdrawn work, old architecture notes, PRDs, or
execution history in this folder. Those belong in `Execution_Pipeline_Docs/` or
`documentation/strategy/` depending on whether they are execution records or
high-level direction.
