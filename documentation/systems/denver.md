# System: Denver — Asset Storage & CDN
## Identity
- Tier: Supporting
- Purpose: File and asset storage with CDN delivery
## Interfaces
- Upload APIs, signed URLs
- Serves widget definitions/assets (`denver/widgets/{widgetType}/spec.json`, `widget.html`, `widget.css`, `widget.client.js`, `agent.md`)
## Dependencies
- Used by: Venice, Bob, Site
## Deployment
- Vercel Blob and/or Supabase Storage
## Rules
- Public assets cacheable; private assets signed, time-limited
## Links
- Back: ../../CONTEXT.md
