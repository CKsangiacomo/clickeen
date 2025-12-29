STATUS: DERIVED — POINTER (NO NEW TRUTH)
This file exists to prevent link rot and reduce doc drift.
The canonical, normative source of truth is: `documentation/systems/sanfrancisco.md`.

# San Francisco — Infrastructure (Pointer)

San Francisco runs as a **Cloudflare Worker** with Cloudflare-native primitives:

- **KV**: hot session state (24h TTL)
- **D1**: queryable indexes (sessions, prompt versions, outcomes)
- **R2**: raw payload storage (logs/traces)
- **Queues**: non-blocking ingestion/logging
- **Cron triggers**: scheduled analysis / maintenance (as needed)

For the complete, authoritative description (including bindings, routes, errors, and security boundary), see:
- `sanfrancisco.md`

If this file and `sanfrancisco.md` disagree, **`sanfrancisco.md` wins**.


