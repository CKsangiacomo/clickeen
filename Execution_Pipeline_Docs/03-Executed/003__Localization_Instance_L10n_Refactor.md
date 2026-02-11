# Instance Localization (L10N) Refactor - Canonical in Supabase, Delivered by Tokyo/R2

Status: Superseded. This doc reflects an older execution plan and no longer matches current layered l10n architecture.
Source of truth: `documentation/` and `Execution_Pipeline_Docs/03-Executed/033__PRD__07-14_Remaining_Work_Closeout.md`.

Status: DRAFT (execution spec)
Owner: Product Dev Team
Scope: Instance localization for Venice + Prague embeds (curated + user instances).

This doc defines the refactor that makes instance localization deterministic, user-truthful,
and still fast at runtime by preserving the "goodness of R2" (global cacheable delivery).

------------------------------------------------------------------------------
GOALS
------------------------------------------------------------------------------
1) One canonical source of truth for localized instance data (user-owned).
2) Deterministic local dev and reproducible production behavior.
3) Preserve Tokyo/R2 as the global, cacheable delivery plane.
4) Fail fast and loudly when localization is missing or stale in dev/CI.
5) Make agent outputs reviewable and promotable when content is curated.

------------------------------------------------------------------------------
NON-GOALS
------------------------------------------------------------------------------
1) Translating UI chrome (i18n catalogs) - out of scope.
2) Changing widget config schema or widget runtime behavior.
3) Changing the locale-free publicId contract.

------------------------------------------------------------------------------
NON-NEGOTIABLE TENETS (RECONFIRMED)
------------------------------------------------------------------------------
- Locale is runtime, not identity (publicId is locale-free).
- Orchestrators are dumb pipes; do not invent defaults or silently heal.
- Localization overlays are set-only ops (no structural edits).
- Deterministic staleness guard: baseFingerprint (required; baseUpdatedAt is metadata only).

------------------------------------------------------------------------------
TERMS
------------------------------------------------------------------------------
- Instance: a widget_instances row in Michael (Supabase).
- Overlay: set-only ops applied on top of the base config.
- Index: per-instance index.json listing layer keys + lastPublishedFingerprint (and geoTargets when used).
- baseFingerprint: sha256(stableStringify(baseConfig)).
- Curated instance: Clickeen-owned (`wgt_curated_*` and `wgt_main_*`).
- User instance: workspace-owned.

------------------------------------------------------------------------------
CURRENT PAIN (WHY THIS REFACTOR)
------------------------------------------------------------------------------
Today the localization agent writes overlays directly into Tokyo/R2. This makes:
- Local dev non-deterministic (local reads filesystem, agent writes R2).
- No git history or review trail for curated content.
- Hidden failures (runtime falls back to base).
- User trust issues (localized content not in their DB).

We must fix that by making Supabase the canonical store and Tokyo/R2 the delivery cache.

------------------------------------------------------------------------------
TARGET ARCHITECTURE (SOURCE VS DELIVERY)
------------------------------------------------------------------------------
Canonical truth:
  - Supabase stores per-instance, per-layer overlays + metadata.
Delivery plane:
  - Tokyo/R2 stores hashed overlay files + per-instance index.json for fast runtime fetch.

Decisions locked:
- Canonical locale allowlist: config/locales.json (single source of truth).
- Publisher location: tokyo-worker (materializes Supabase -> Tokyo/R2 artifacts).
- Geo resolution precedence: explicit locale param -> geo rules -> default locale.

Local dev:
  - Same pipeline, but Tokyo is local filesystem and Supabase is local.

Cloud-dev/prod:
  - Same pipeline, but Tokyo is R2 and Supabase is remote.

------------------------------------------------------------------------------
GA LOCALES + SCALE (NON-NEGOTIABLE)
------------------------------------------------------------------------------
Locale source of truth:
- config/locales.json is the runtime allowlist and must include the supported locales below.
- Paris validates locale inputs against this list.
- Agent only generates overlays for locales in this list (or explicit allowlist).

Supported locales (unified coverage, no phases):
- en, es, pt, de, fr
- it, nl, ja, zh-tw (Traditional Chinese), hi, ko
- pl, tr, ar (RTL)

Locale token rule:
- If we adopt script tags (e.g. zh-Hant), update locale normalization and
  validation to accept BCP47 script subtags (not just xx or xx-YY).

Runtime rules:
- Locale tokens must be normalized (lowercase, bcp47-ish: en, es, es-mx).
- Exact match first, then base language fallback (es-mx -> es) if present.
- If requested locale is unsupported, dev/CI fails; prod logs + falls back to base.

Operational scale:
- The system must handle 100s of widgets and 10k+ instances without per-widget code.
- All localization is driven by per-widget allowlists (tokyo/widgets/*/localization.json).
- The pipeline remains deterministic because overlays are set-only ops.

------------------------------------------------------------------------------
DATA MODEL (SUPABASE)
------------------------------------------------------------------------------
Table: widget_instance_overlays

Columns:
- id uuid pk default gen_random_uuid()
- public_id text not null  -- locale-free
- layer text not null      -- locale | geo | industry | experiment | account | behavior | user
- layer_key text not null  -- layer-specific key (e.g., locale token)
- ops jsonb not null       -- set-only ops (agent/manual base overlay)
- user_ops jsonb not null  -- set-only ops (per-field manual overrides)
- base_fingerprint text    -- required for new writes
- base_updated_at timestamptz nullable (legacy support)
- source text not null     -- 'agent' | 'manual' | 'import' | 'user'
- geo_targets text[]       -- optional country allowlist for geo/locale targeting (ISO-3166-1 alpha-2)
- workspace_id uuid        -- nullable for curated; required for user instances
- updated_at timestamptz default now()
- created_at timestamptz default now()

Constraints:
- unique(public_id, layer, layer_key)
- ops is array, all entries are { op: "set", path, value }.
- user_ops is array, all entries are { op: "set", path, value }.
- public_id matches locale-free grammar.
- layer and layer_key validated by policy (locale keys must be in config/locales.json).

Indexes:
- (public_id)
- (workspace_id)

RLS POLICIES (REQUIRED)
------------------------------------------------------------------------------
Enable RLS on widget_instance_overlays and add these policies:

1) SELECT (curated/public)
   - Allow read when instance is curated (publicId pattern) OR
     requester has workspace membership for workspace_id.
2) INSERT curated (internal only)
   - Allow service role or internal token (SF/Paris) for curated instances.
3) INSERT user (workspace scoped)
   - Allow when requester is editor of workspace_id.
4) UPDATE (same scope as insert)
   - Allow only if requester is editor of workspace_id OR internal token.
5) DELETE (same scope as update)
   - Allow only if requester is editor of workspace_id OR internal token.

Note: This prevents cross-workspace leaks and keeps user overrides isolated in user_ops.

Sample SQL (migration):
```sql
ALTER TABLE widget_instance_overlays ENABLE ROW LEVEL SECURITY;

-- 1) SELECT: curated (public) + own workspace overlays
CREATE POLICY "select_overlays"
  ON widget_instance_overlays
  FOR SELECT
  USING (
    workspace_id IS NULL
    OR workspace_id IN (
      SELECT workspace_id
      FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- 2) INSERT curated: service role only
CREATE POLICY "insert_curated_overlays"
  ON widget_instance_overlays
  FOR INSERT
  WITH CHECK (
    workspace_id IS NULL
    AND auth.role() = 'service_role'
  );

-- 3) INSERT user: workspace editors only
CREATE POLICY "insert_user_overlays"
  ON widget_instance_overlays
  FOR INSERT
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id
      FROM workspace_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'editor')
    )
  );

-- 4) UPDATE: editors or service role, but block agent overwrites of user edits
CREATE POLICY "update_overlays"
  ON widget_instance_overlays
  FOR UPDATE
  USING (
    (
      workspace_id IS NOT NULL
      AND workspace_id IN (
        SELECT workspace_id
        FROM workspace_members
        WHERE user_id = auth.uid()
          AND role IN ('owner', 'admin', 'editor')
      )
    )
    OR (auth.role() = 'service_role' AND source <> 'user')
  )
  WITH CHECK (
    (
      workspace_id IS NOT NULL
      AND workspace_id IN (
        SELECT workspace_id
        FROM workspace_members
        WHERE user_id = auth.uid()
          AND role IN ('owner', 'admin', 'editor')
      )
    )
    OR (auth.role() = 'service_role' AND source <> 'user')
  );

-- 5) DELETE: editors or service role
CREATE POLICY "delete_overlays"
  ON widget_instance_overlays
  FOR DELETE
  USING (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id
      FROM workspace_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'editor')
    )
    OR auth.role() = 'service_role'
  );
```

------------------------------------------------------------------------------
WIDGET CONTENT COVERAGE (OBJECT MANAGER, DROPDOWN EDIT, ETC)
------------------------------------------------------------------------------
Dynamic content sources we must support:
- Object manager (arrays of sections/items/blocks).
- Repeater + dropdown edit (inline richtext fields).
- User-added content (new items added post-launch).

How we support them:
1) Allowlist paths use wildcard segments for arrays:
   Example: sections.*.faqs.*.question
2) Agent collects concrete paths by traversing config arrays at publish time.
3) On every publish/update, overlays are regenerated for current config.
4) Richtext values (dropdown edit) are translated as HTML strings with tags preserved.

Key rule:
- We localize what exists in the instance config at the time of publish.
- If the user adds new items later, the next publish triggers a new overlay.

Limits (protects scale):
- Hard caps on number of items and total characters per job (enforced in SF).
- If caps are hit, job fails in dev and logs in prod (no silent partials).

------------------------------------------------------------------------------
PARIS API (CANONICAL WRITES)
------------------------------------------------------------------------------
New endpoints (internal, service-only):
- PUT /api/instances/:publicId/locales/:locale
  Body: { ops?, userOps?, baseFingerprint, baseUpdatedAt?, source? }
  Auth: service role or internal token (SF only)

- GET /api/instances/:publicId/locales
  Returns list of locales + metadata (debug/devtools).

- GET /api/instances/:publicId/locales/:locale
  Returns the overlay ops + metadata for a single locale (canonical read for previews).

User override endpoint (editor access):
- DELETE /api/instances/:publicId/locales/:locale
  Clears user_ops overrides and falls back to agent/auto for those fields.
  Used by "Revert to auto-translate" in UI.
  Requires workspaceId query param for user instances.

Existing:
- PUT /api/workspaces/:workspaceId/locales
  Maintains workspace locale selections (entitlement gating).

Rules:
- Paris requires and validates baseFingerprint.
- Paris rejects ops that touch non-allowlisted paths.
- Paris must enforce workspace ownership for user instances.
- Paris must reject locale suffix in publicId.
- Paris must preserve user_ops when writing ops (agent/manual).

PARIS API ERROR CODES
------------------------------------------------------------------------------
Response shape:
{ error?: { code: string, message: string, detail?: unknown } }

Codes:
- LOCALE_INVALID: Locale not in config/locales.json
- LOCALE_NOT_ENTITLED: Workspace tier disallows locale count
- OPS_INVALID_PATH: Op path not in allowlist
- OPS_INVALID_TYPE: Op not { op: 'set', path, value }
- FINGERPRINT_MISMATCH: baseFingerprint != current instance
- WORKSPACE_MISMATCH: publicId does not belong to workspace
- INSTANCE_NOT_FOUND: publicId does not exist
- UNAUTHORIZED: caller not workspace editor / service role

Status mapping:
- 200: Success
- 400: LOCALE_INVALID, OPS_INVALID_*
- 403: LOCALE_NOT_ENTITLED, WORKSPACE_MISMATCH, UNAUTHORIZED
- 404: INSTANCE_NOT_FOUND
- 409: FINGERPRINT_MISMATCH
- 500: Internal error

------------------------------------------------------------------------------
SAN FRANCISCO AGENT FLOW (WRITE TO PARIS, NOT TOKYO)
------------------------------------------------------------------------------
Trigger:
- On instance publish/update (Paris enqueues l10n jobs).
- Curated: all supported locales. User: workspace selection + entitlements.

Agent steps:
1) Fetch instance from Paris (base config + updatedAt).
2) Fetch allowlist from Tokyo (widget localization.json).
3) Collect translatable entries from base config.
4) Translate and build set-only ops.
5) POST overlay to Paris endpoint (canonical store).
6) Paris enqueues "publish overlay" job for Tokyo output.

Idempotency:
- If overlay already exists with same baseFingerprint, skip.
- Agent writes update ops; user_ops (manual overrides) remain intact.

------------------------------------------------------------------------------
TOKYO PUBLISHER (SUPABASE -> R2 ARTIFACTS)
------------------------------------------------------------------------------
Purpose: materialize runtime artifacts from canonical DB.

Inputs:
- widget_instance_overlays rows (public_id, layer, layer_key, ops, user_ops, base_fingerprint).

Outputs:
- tokyo/l10n/instances/<publicId>/index.json
- tokyo/l10n/instances/<publicId>/<layer>/<layerKey>/<baseFingerprint>.ops.json

Index entry (per layer key):
- keys[] + lastPublishedFingerprint (+ geoTargets when configured)

Algorithm:
1) Read all overlays for curated + user instances.
2) For each overlay:
   - Validate set-only ops (ops + user_ops; user_ops applied last).
   - Stable stringify -> hash -> write overlay file.
3) Build per-instance index.json mapping layer -> keys (+ lastPublishedFingerprint / geoTargets metadata).
4) Publish to R2 with immutable cache headers.

Trigger modes:
- Event-driven: on overlay upsert, enqueue publish job.
- Scheduled: sweep dirty publish states and enqueue repairs (no global rebuild).

TOKYO-WORKER IMPLEMENTATION (DECIDED)
------------------------------------------------------------------------------
Location:
- tokyo-worker hosts the publisher (single place that writes Tokyo/R2 artifacts).

Queue + triggers:
- Paris enqueues a "publish-l10n" job when an overlay is upserted.
- tokyo-worker consumes the queue and writes artifacts to R2.
- Scheduled job replays dirty publish states only (repair drift without global rebuild).

tokyo-worker bindings (dev example):
- wrangler.toml:
  [[queues.consumers]]
  queue = "instance-l10n-publish-cloud-dev"
- Env vars (dev via .dev.vars / prod via CF Secrets):
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  ENV_STAGE
  TOKYO_DEV_JWT (existing, for internal write endpoints)

Inputs:
- Supabase read credentials (service role) scoped to widget_instance_overlays.
- Optional filter by updated_at for incremental builds.

Write strategy:
- For each (public_id, locale):
  - Validate ops and baseFingerprint.
  - Stable stringify -> sha256 hash -> filename: <locale>.<hash>.ops.json
  - Write to tokyo/l10n/instances/<publicId>/...
  - Update tokyo/l10n/instances/<publicId>/index.json atomically.

Caching:
- Overlay files: Cache-Control: public, max-age=31536000, immutable.
- Manifest: Cache-Control: public, max-age=60, s-maxage=60.

Failure handling:
- If overlay write fails, log and retry (queue retry policy).
- If manifest write fails, requeue full rebuild.

SUPABASE QUERY CONTRACT (PUBLISHER)
------------------------------------------------------------------------------
Table: widget_instance_overlays

Required columns for publishing:
- public_id, locale, ops, base_fingerprint, base_updated_at, geo_countries, source, updated_at

Single-instance fetch (by public_id):
GET {SUPABASE_URL}/rest/v1/widget_instance_overlays
  ?public_id=eq.{publicId}
  &select=public_id,locale,ops,user_ops,base_fingerprint,base_updated_at,geo_countries,source,updated_at

Single-locale fetch (optional):
GET {SUPABASE_URL}/rest/v1/widget_instance_overlays
  ?public_id=eq.{publicId}&locale=eq.{locale}
  &select=public_id,locale,ops,user_ops,base_fingerprint,base_updated_at,geo_countries,source,updated_at

Incremental rebuild (by updated_at):
GET {SUPABASE_URL}/rest/v1/widget_instance_overlays
  ?updated_at=gt.{isoTimestamp}
  &select=public_id,locale,ops,base_fingerprint,base_updated_at,geo_countries,source,updated_at
  &order=public_id.asc,locale.asc

Pagination:
- Use Range headers (e.g., Range: 0-999) and follow Content-Range.

Auth:
- Headers:
  apikey: {SUPABASE_SERVICE_ROLE_KEY}
  Authorization: Bearer {SUPABASE_SERVICE_ROLE_KEY}

Publisher rules:
- Publish exactly one row per (public_id, locale) (unique constraint enforced).
- Publish ops + user_ops (user_ops applied last).
- base_fingerprint is required; base_updated_at is metadata only.

------------------------------------------------------------------------------
RUNTIME RESOLUTION (VENICE + PRAGUE)
------------------------------------------------------------------------------
Locale resolution:
1) Request locale (explicit query param).
1b) Geo targeting (if configured): if request country is in geo_countries for a locale, force that locale.
2) Workspace locale routing (future, if configured).
3) defaultLocale (workspace or system default).

Overlay resolution:
1) Load manifest from Tokyo.
2) Choose best locale candidate (exact -> base language).
3) Load overlay file and verify baseFingerprint.
4) Apply set-only ops to config.

Fail-fast rules:
- In dev/CI: missing overlay for curated instance in non-default locale is an error.
- In prod: optional soft fallback to base, but log warning + enqueue rebuild.

------------------------------------------------------------------------------
BOB EDITOR: LOCALE PREVIEW + USER OVERRIDES (SETTINGS)
------------------------------------------------------------------------------
Goal:
- Higher tiers can preview and edit locale-specific content directly in Bob.

Visibility/gating:
- Show a "Locale" dropdown only when policy l10n.enabled is true.
- Locale list = workspace.l10n_locales plus the base locale.
- Enforce l10n.locales.max (UI should disable adding beyond cap).

Preview behavior:
- Selecting a locale loads the canonical overlay from Paris and applies it on top of the base config.
- Tokyo is the delivery plane for runtime, not the source of truth for preview.
- Base config remains the authoritative source for non-localized fields.
- UI must display "Editing locale: <LOCALE>" to avoid confusion.

Manual override:
- When a non-base locale is selected, edits are saved as user_ops (per-field overrides).
- Agent writes keep user_ops intact; only non-overridden fields are updated.

Revert workflow:
- "Revert to auto-translate" calls DELETE /api/instances/:publicId/locales/:locale.
- After delete, editor clears user_ops and falls back to agent overlay (or base if none exists).

Staleness guard:
- If base config changes after a locale override, mark locale overlays as stale.
- UI should prompt to re-translate or re-apply edits (no silent mismatch).

------------------------------------------------------------------------------
PROMOTION PATHS (CURATED CONTENT)
------------------------------------------------------------------------------
Curated overlays must be reviewable in git.

Two-way sync:
1) Git -> Supabase:
   - Use `node scripts/l10n/push.mjs` (requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).
2) Supabase -> Git:
   - Use `node scripts/l10n/pull.mjs` to pull curated overlays from Supabase
     and create a PR (useful when SF auto-generates).

Priority:
- Manual curated overlays in git override agent overlays.

------------------------------------------------------------------------------
LOCAL DEV WORKFLOW
------------------------------------------------------------------------------
1) Developer edits or adds overlays in l10n/instances/**.
2) pnpm build:l10n -> tokyo/l10n/** (local).
3) Local Tokyo dev server serves overlays.
4) Bob preview reads overlays from local Paris (canonical).
5) Local Paris + SF outputs are written to local Supabase
   and published to local Tokyo for deterministic runtime.

Rule: local Prague/Venice must never depend on cloud-dev R2.

------------------------------------------------------------------------------
FAILURE MODES AND BEHAVIOR
------------------------------------------------------------------------------
1) Agent down:
   - No new overlays. Runtime shows base config.
   - Dev: fail fast on curated instances.
2) Tokyo publish fails:
   - DB has overlays, runtime misses artifacts. Log + requeue.
3) Stale overlay:
   - baseFingerprint mismatch -> overlay rejected.
4) Allowlist mismatch:
   - overlay rejected at Paris validation.
5) Env drift:
   - If local Tokyo reads filesystem but overlays only exist in R2, localization
     "disappears" locally. This refactor prevents that by using Supabase + publisher.

------------------------------------------------------------------------------
SECURITY AND ACCESS
------------------------------------------------------------------------------
- Agent writes go only to Paris (service token).
- Tokyo write endpoints remain internal (TOKYO_DEV_JWT never in browser).
- Public reads are only from Tokyo GET endpoints.
- Users never see TOKYO credentials.

------------------------------------------------------------------------------
MIGRATION STEPS (FROM CURRENT STATE)
------------------------------------------------------------------------------
Step 1: Inventory
- Enumerate current overlays in R2 (tokyo/l10n/instances/<publicId>/index.json).
- Export curated overlays to git for review.

Step 2: Supabase schema + Paris endpoints
- Create widget_instance_overlays table.
- Add Paris endpoints and validation.

Step 3: Agent writes to Paris
- Update SF l10n agent to call Paris endpoint.

Step 4: Tokyo publisher
- Implement publish job and run on schedule + on update.

Step 5: Runtime strictness in dev
- Make missing overlay for curated non-default locale fail fast.

Step 6: Clean up legacy paths
- Deprecate direct SF -> Tokyo writes for overlays.

------------------------------------------------------------------------------
OPEN QUESTIONS (MUST RESOLVE BEFORE SHIP)
------------------------------------------------------------------------------
- baseFingerprint implementation location (shared @clickeen/l10n).
- Locale routing policy (country -> locale) storage and API.
- Default locale precedence (workspace vs global).
- How to expose localized content in DevStudio (view + diff + rollback).

------------------------------------------------------------------------------
CHECKLIST (DONE WHEN)
------------------------------------------------------------------------------
- Supabase stores all localized instance ops.
- Tokyo/R2 artifacts are generated from Supabase.
- Local dev uses local Supabase + local Tokyo; no cloud dependency.
- Curated overlays are reviewable in git and promotable from agent outputs.
- Runtime fails loudly in dev when curated localization is missing.

------------------------------------------------------------------------------
EXECUTION CHECKLIST + MILESTONES (LOCK BEFORE CODE)
------------------------------------------------------------------------------
Milestone 0: Decision lock + doc alignment
- Locale allowlist confirmed in config/locales.json and referenced in docs.
- Publisher location locked to tokyo-worker.
- Geo resolution precedence locked (explicit locale -> geo rules -> default).

Milestone 1: Supabase schema + RLS
- Migration adds widget_instance_overlays + geo_countries.
- RLS policies applied (5 policies in this doc).
- Constraints + indexes verified.
Acceptance:
- Cannot read/write cross-workspace data.
- Service role can upsert curated overlays.

Milestone 2: Paris API (canonical writes)
- PUT/GET/DELETE locale endpoints implemented.
- Allowlist + baseFingerprint validation enforced.
- Error codes contract implemented.
Acceptance:
- Agent writes always update ops; user_ops overrides are preserved.

Milestone 3: San Francisco agent writes to Paris
- SF l10n agent calls Paris endpoint (no Tokyo writes).
  - Preserve user_ops when updating ops.
Acceptance:
- New overlays appear in Supabase (not in R2 yet).

Milestone 4: Tokyo publisher (tokyo-worker)
- Queue consumer reads Supabase and writes Tokyo/R2 artifacts.
- Nightly rebuild job in place.
Acceptance:
- tokyo/l10n/instances/<publicId>/index.json and hashed overlays match Supabase.

Milestone 5: Venice runtime + dev strictness
- Apply overlays based on baseFingerprint.
- Dev/CI fails when curated locale overlay missing.
Acceptance:
- Missing overlay in dev throws, prod logs + fallback.

Milestone 6: Bob locale preview + override UI
- Settings locale dropdown (gated by entitlements).
- Edits in locale mode save user_ops overrides.
- Revert button wired to DELETE endpoint.
Acceptance:
- Manual overrides persist per-field; agent updates fill the rest.

Milestone 7: Backfill + verification
- Import existing R2 overlays to Supabase.
- Sync curated overlays to git where needed.
Acceptance:
- Prague shows localized content in local dev and cloud-dev.

------------------------------------------------------------------------------
EXECUTION RUNBOOK (AUTONOMOUS STEPS)
------------------------------------------------------------------------------
Step 0: Verify local services
- supabase status
- Ensure tokyo-worker, paris, venice can run locally.

Step 1: Apply Supabase migration
- supabase db push
- Verify table + RLS: widget_instance_overlays exists, policies present.

Step 2: Paris endpoints (canonical write/read/delete)
- Implement PUT/GET/DELETE /api/instances/:publicId/locales/:locale
- Enforce allowlists + baseFingerprint + error codes.
- Add tests or minimal request fixtures (if present).

Step 3: San Francisco agent -> Paris
- Replace Tokyo write with Paris PUT.
  - Preserve user_ops on updates.

Step 4: tokyo-worker publisher
- Add queue consumer + Supabase fetch.
- Materialize tokyo/l10n artifacts.
- Add nightly rebuild (cron trigger).

Step 5: Venice runtime updates
- Enforce baseFingerprint.
- Apply geo rules (explicit locale param first).
- Dev/CI fail-fast for curated missing overlays.

Step 6: Bob settings + locale preview
- Locale dropdown (gated).
- Manual override -> user_ops.
- Revert button -> DELETE endpoint.

Step 7: Backfill + parity check
- Import R2 overlays to Supabase.
- Rebuild Tokyo manifest.
- Confirm Prague/Venice localization in local + cloud-dev.

Notes:
- Do not edit instances directly (human/system only).
- No destructive Supabase resets.
