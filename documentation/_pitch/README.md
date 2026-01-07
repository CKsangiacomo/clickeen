# Pitch-only documentation (Investor corpus)

**Audience:** Investors (Pitch Agent)  
**Status:** Narrative / positioning docs — **NOT** execution contracts  
**Source of truth for engineering:** everything **outside** `documentation/_pitch/` (e.g. `documentation/architecture/*`, `documentation/services/*`, PRDs)

## What this folder is

This folder exists to store **investor-facing** material that helps the Pitch Agent answer questions accurately **without polluting** the core engineering documentation.

Examples of what belongs here:
- Company narrative, elevator pitch, positioning
- Market framing, ICPs, competitor analysis
- Moat explanation (high-level), go-to-market story
- Risk list + mitigations (high-level)
- Investor FAQ (funding, roadmap, traction)

## What must NOT go here

Do **not** put execution truth here:
- API contracts, schema definitions, migrations
- “How X works” technical docs that engineers will rely on
- Anything that could drift and mislead builds/agents

If you need to reference implementation details, **link** to canonical docs instead of rewriting them.

## Indexing rules (intended)

Pitch Agent ingestion should:
- Always ingest: `documentation/_pitch/**`
- Optionally ingest: a small allowlist of canonical docs (e.g. `documentation/architecture/Overview.md`, `documentation/services/venice.md`) for factual grounding
- Exclude `documentation/_pitch/**` from general engineering agent crawls (when applicable)


