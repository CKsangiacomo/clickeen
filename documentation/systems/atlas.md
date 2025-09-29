# System: Atlas — Config & Cache Layer
## Identity
- Tier: Core
- Purpose: Edge cache for widget configs, decouple Venice from Michael
## Interfaces
- KV lookups, cache invalidations
## Dependencies
- Depends on: Michael
- Used by: Venice
## Deployment
- c-keen-embed (edge functions + KV)
## Rules
- Stale-while-revalidate
## Links
- Back: ../../CONTEXT.md
