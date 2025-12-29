STATUS: DERIVED — POINTER (NO NEW TRUTH)
This file exists to prevent link rot and reduce doc drift.
The canonical, normative source of truth is: `documentation/systems/sanfrancisco.md`.

# San Francisco — Learning Loop (Pointer)

San Francisco’s learning loop is implemented as part of the **San Francisco system** and is documented in:
- `sanfrancisco.md` (sections: learning, storage, jobs, logging, outcomes)

## Quick summary

- **Log every execution** (non-blocking)
- **Store raw payloads cheaply** (R2)
- **Keep queryable indexes** (D1)
- **Keep hot session state** (KV)
- **Use Queues + Cron** for async ingestion and scheduled analysis

If this file and `sanfrancisco.md` disagree, **`sanfrancisco.md` wins**.


