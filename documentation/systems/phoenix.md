# System: Phoenix — Event Bus
## Identity
- Tier: Supporting
- Purpose: Async messaging (V0 Redis/Vercel KV)
## Interfaces
- Publish/subscribe topics, event schemas
## Dependencies
- Used by: Bob, Michael, Atlas
## Deployment
- c-keen-embed (KV) and c-keen-app producers/consumers
## Rules
- At-least-once delivery; idempotent handlers
## Links
- Back: ../../CONTEXT.md
