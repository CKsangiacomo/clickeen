STATUS: INFORMATIVE — FUTURE (NOT PHASE-1)
Phase-1 excludes Tokyo. Future billing/upsell work requires explicit CEO approval before implementation.

# System: Tokyo — Billing & Upsell (Future)
## Identity
- Tier: Core
- Purpose: Stripe billing, entitlements
## Interfaces
- Webhooks, customer portal
## Dependencies
- Depends on: Robert
- Used by: Bob
## Deployment
- Supabase functions + c-keen-app UI
## Rules
- Entitlements cached at edge via Atlas
## Links
- Back: ../../CONTEXT.md
