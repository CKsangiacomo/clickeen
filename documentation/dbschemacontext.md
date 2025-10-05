

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."billing_product" AS ENUM (
    'widget_premium_seat',
    'widget_basic_seat'
);


ALTER TYPE "public"."billing_product" OWNER TO "postgres";


CREATE TYPE "public"."create_widget_with_instance_result" AS (
	"public_key" "text",
	"public_id" "text"
);


ALTER TYPE "public"."create_widget_with_instance_result" OWNER TO "postgres";


CREATE TYPE "public"."package_status" AS ENUM (
    'active',
    'paused',
    'canceled'
);


ALTER TYPE "public"."package_status" OWNER TO "postgres";


CREATE TYPE "public"."user_created_source" AS ENUM (
    'signup_form',
    'invite',
    'plg_widget',
    'system',
    'api',
    'import'
);


ALTER TYPE "public"."user_created_source" OWNER TO "postgres";


CREATE TYPE "public"."widget_instance_status" AS ENUM (
    'draft',
    'published',
    'inactive'
);


ALTER TYPE "public"."widget_instance_status" OWNER TO "postgres";


CREATE TYPE "public"."workspace_role" AS ENUM (
    'owner',
    'admin',
    'super_editor',
    'editor',
    'collaborator',
    'viewer'
);


ALTER TYPE "public"."workspace_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."backfill_submission_created_events_v1"("p_limit" integer DEFAULT 1000) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_inserted integer := 0;
BEGIN
  WITH created_events AS (
    SELECT e.entity_id
    FROM public.events e
    WHERE e.entity_type = 'submission'
      AND e.event_type  = 'submission.created'
  ),
  to_insert AS (
    SELECT
      s.id            AS submission_id,
      w.workspace_id  AS workspace_id,
      s.payload       AS payload,
      s.ts            AS created_at
    FROM public.widget_submissions s
    JOIN public.widgets w ON w.id = s.widget_id
    LEFT JOIN created_events ce ON ce.entity_id = s.id
    WHERE ce.entity_id IS NULL
    ORDER BY s.ts
    LIMIT p_limit
  )
  INSERT INTO public.events (workspace_id, entity_type, entity_id, event_type, actor_id, payload, metadata, created_at)
  SELECT
    ti.workspace_id,
    'submission'::text,
    ti.submission_id,
    'submission.created'::text,
    NULL::uuid,
    COALESCE(ti.payload, '{}'::jsonb),
    '{}'::jsonb,
    ti.created_at
  FROM to_insert ti
  RETURNING 1 INTO v_inserted;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;


ALTER FUNCTION "public"."backfill_submission_created_events_v1"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_feature_limit_v1"("p_workspace_id" "uuid", "p_feature_key" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_limit   int;
  v_usage   int;
  v_allowed boolean;
BEGIN
  -- 1) Look up the plan’s limit for this feature
  SELECT pl.limit_value
    INTO v_limit
  FROM public.workspaces w
  JOIN public.plan_limits pl
    ON w.plan = pl.plan_id            -- your table uses plan_id
  WHERE w.id = p_workspace_id
    AND pl.limit_type = p_feature_key -- your table uses limit_type
  LIMIT 1;

  -- If no limit row, treat as unlimited (-1)
  v_limit := COALESCE(v_limit, -1);

  -- 2) Current month usage (from the summary view we created)
  SELECT COALESCE((
           SELECT month_total
           FROM public.usage_monthly_summary
           WHERE workspace_id = p_workspace_id
             AND feature_key  = p_feature_key
             AND month        = date_trunc('month', now())
         ), 0)
    INTO v_usage;

  -- 3) Allowed? (-1 means unlimited)
  v_allowed := (v_limit = -1) OR (v_usage < v_limit);

  RETURN jsonb_build_object(
    'workspace_id', p_workspace_id,
    'feature_key',  p_feature_key,
    'limit',        v_limit,
    'usage',        v_usage,
    'allowed',      v_allowed
  );
END;
$$;


ALTER FUNCTION "public"."check_feature_limit_v1"("p_workspace_id" "uuid", "p_feature_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_widget_draft_v1"("p_widget_instance_id" "uuid", "p_draft_token" "uuid", "p_workspace_id" "uuid", "p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_instance widget_instances;
  v_result   jsonb;
BEGIN
  -- Fetch instance ignoring claimed_at for better diagnostics
  SELECT * INTO v_instance
  FROM public.widget_instances
  WHERE id = p_widget_instance_id
    AND draft_token = p_draft_token
    AND expires_at > now()
  LIMIT 1;

  -- No match at all → invalid or expired
  IF v_instance.id IS NULL THEN
    INSERT INTO public.widget_claim_audit (widget_instance_id, workspace_id, user_id, draft_token, success, reason)
    VALUES (p_widget_instance_id, p_workspace_id, p_user_id, p_draft_token, false, 'invalid_or_expired_draft');
    RETURN jsonb_build_object('success', false, 'error', 'invalid_or_expired_draft');
  END IF;

  -- Already claimed
  IF v_instance.claimed_at IS NOT NULL THEN
    INSERT INTO public.widget_claim_audit (widget_instance_id, workspace_id, user_id, draft_token, success, reason)
    VALUES (v_instance.id, p_workspace_id, p_user_id, p_draft_token, false, 'already_claimed');
    RETURN jsonb_build_object('success', false, 'error', 'already_claimed');
  END IF;

  -- Claim it
  UPDATE public.widget_instances
  SET status = 'published',
      claimed_at = now(),
      updated_at = now()
  WHERE id = v_instance.id;

  -- Log success
  INSERT INTO public.widget_claim_audit (widget_instance_id, workspace_id, user_id, draft_token, success, reason)
  VALUES (v_instance.id, p_workspace_id, p_user_id, p_draft_token, true, null);

  v_result := jsonb_build_object(
    'success', true,
    'status', 'claimed',
    'claimed_at', now(),
    'widget_instance_id', v_instance.id
  );

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."claim_widget_draft_v1"("p_widget_instance_id" "uuid", "p_draft_token" "uuid", "p_workspace_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_widget_instance_v1"("p_widget_instance_id" "uuid", "p_draft_token" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_now timestamptz := now();
  v_row RECORD;
BEGIN
  -- Lock the row
  SELECT id, draft_token, claimed_at, expires_at, public_id, status
  INTO v_row
  FROM public.widget_instances
  WHERE id = p_widget_instance_id
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  -- Validate token presence and match
  IF v_row.draft_token IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_draft_token');
  END IF;

  IF v_row.draft_token <> p_draft_token THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_token');
  END IF;

  -- Check expiry
  IF v_row.expires_at IS NOT NULL AND v_row.expires_at <= v_now THEN
    -- clear expired token
    UPDATE public.widget_instances
       SET draft_token = NULL
     WHERE id = p_widget_instance_id;

    RETURN jsonb_build_object('success', false, 'error', 'token_expired');
  END IF;

  -- If already claimed, return info
  IF v_row.claimed_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'widget_instance_id', v_row.id,
      'claimed_at', v_row.claimed_at,
      'public_id', v_row.public_id
    );
  END IF;

  -- Claim now: mark claimed, clear token
  UPDATE public.widget_instances
     SET claimed_at  = v_now,
         draft_token = NULL
   WHERE id = p_widget_instance_id;

  -- Emit event
  INSERT INTO public.events (workspace_id, entity_type, entity_id, event_type, payload, created_at)
  SELECT w.workspace_id, 'widget_instance', wi.id, 'widget_instance.claimed',
         jsonb_build_object('public_id', wi.public_id),
         v_now
  FROM public.widget_instances wi
  JOIN public.widgets w ON w.id = wi.widget_id
  WHERE wi.id = p_widget_instance_id;

  RETURN jsonb_build_object(
    'success', true,
    'widget_instance_id', p_widget_instance_id,
    'claimed_at', v_now
  );
END;
$$;


ALTER FUNCTION "public"."claim_widget_instance_v1"("p_widget_instance_id" "uuid", "p_draft_token" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."consume_feature_units_v1"("p_workspace_id" "uuid", "p_feature_key" "text", "p_quantity" integer DEFAULT 1) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_limit    int;
  v_used     int;
  v_new_used int;
  v_allowed  boolean;
BEGIN
  -- Plan limit lookup
  SELECT pl.limit_value
    INTO v_limit
  FROM public.workspaces w
  JOIN public.plan_limits pl
    ON w.plan = pl.plan_id
  WHERE w.id = p_workspace_id
    AND pl.limit_type = p_feature_key
  LIMIT 1;

  v_limit := COALESCE(v_limit, -1);

  -- Current-month usage
  SELECT COALESCE(SUM(quantity), 0)
    INTO v_used
  FROM public.usage_events
  WHERE workspace_id = p_workspace_id
    AND feature_key  = p_feature_key
    AND created_at  >= date_trunc('month', now());

  v_new_used := v_used + COALESCE(p_quantity, 1);
  v_allowed  := (v_limit = -1) OR (v_new_used <= v_limit);

  -- Record usage with a non-null event_type
  IF v_allowed THEN
    INSERT INTO public.usage_events (workspace_id, event_type, feature_key, quantity, metadata)
    VALUES (p_workspace_id, 'feature_usage', p_feature_key, COALESCE(p_quantity, 1), '{}'::jsonb);
  END IF;

  RETURN jsonb_build_object(
    'workspace_id', p_workspace_id,
    'feature_key',  p_feature_key,
    'limit',        v_limit,
    'usage_before', v_used,
    'usage_after',  CASE WHEN v_allowed THEN v_new_used ELSE v_used END,
    'delta',        CASE WHEN v_allowed THEN COALESCE(p_quantity, 1) ELSE 0 END,
    'allowed',      v_allowed
  );
END;
$$;


ALTER FUNCTION "public"."consume_feature_units_v1"("p_workspace_id" "uuid", "p_feature_key" "text", "p_quantity" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_widget_with_instance"("p_name" "text", "p_type" "text", "p_config" "jsonb") RETURNS "public"."create_widget_with_instance_result"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  v_public_id  text := 'w_'  || encode(gen_random_bytes(8),  'hex');
  v_public_key text := 'wk_' || encode(gen_random_bytes(12), 'hex');

  -- ✅ Match the actual column type (UUID) robustly
  v_widget_id  public.widgets.id%TYPE;

  v_result     public.create_widget_with_instance_result;
BEGIN
  -- Insert widget owned by the system user (must exist in auth.users)
  INSERT INTO public.widgets (user_id, name, type, public_key, config)
  VALUES (
    '11111111-1111-1111-1111-111111111111',
    COALESCE(p_name, 'Anonymous Widget'),
    COALESCE(p_type, 'contact-form'),
    v_public_key,
    COALESCE(p_config, '{}'::jsonb)
  )
  RETURNING id INTO v_widget_id;

  -- Insert published instance
  INSERT INTO public.widget_instances (widget_id, public_id, status, config)
  VALUES (
    v_widget_id,
    v_public_id,
    'published',
    COALESCE(p_config, '{}'::jsonb)
  );

  v_result.public_key := v_public_key;
  v_result.public_id  := v_public_id;
  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'create_widget_with_instance failed [%] %', SQLSTATE, SQLERRM
  USING ERRCODE = SQLSTATE;
END $$;


ALTER FUNCTION "public"."create_widget_with_instance"("p_name" "text", "p_type" "text", "p_config" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_widget_with_instance"("p_name" "text", "p_type" "text", "p_public_key" "text", "p_public_id" "text", "p_widget_config" "jsonb", "p_instance_config" "jsonb") RETURNS TABLE("public_key" "text", "public_id" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_widget_id bigint;
begin
  -- Insert widget
  insert into public.widgets(name, type, public_key, config, status)
  values (p_name, p_type, p_public_key, coalesce(p_widget_config, '{}'::jsonb), 'active')
  returning id into v_widget_id;

  -- Insert instance
  insert into public.widget_instances(widget_id, public_id, config, status)
  values (v_widget_id, p_public_id, coalesce(p_instance_config, '{}'::jsonb), 'published');

  -- Return keys
  return query select p_public_key, p_public_id;
end;
$$;


ALTER FUNCTION "public"."create_widget_with_instance"("p_name" "text", "p_type" "text", "p_public_key" "text", "p_public_id" "text", "p_widget_config" "jsonb", "p_instance_config" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_workspace_for_user_v1"("p_plan" "text" DEFAULT 'free'::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_workspace_id uuid;
  v_user_id uuid;
begin
  -- Ensure we have a logged-in user
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Insert workspace with default name
  insert into public.workspaces (id, name, plan)
  values (
    gen_random_uuid(),
    'Untitled Workspace',
    coalesce(p_plan, 'free')
  )
  returning id into v_workspace_id;

  -- Insert owner membership
  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_workspace_id, v_user_id, 'owner');

  return v_workspace_id;
end;
$$;


ALTER FUNCTION "public"."create_workspace_for_user_v1"("p_plan" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_workspace_v1"("p_plan" "text" DEFAULT 'free'::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_ws uuid;
begin
  -- Require authentication (caller must have user_id claim)
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  -- Generate UUID explicitly
  v_ws := gen_random_uuid();

  -- Insert into workspaces
  insert into public.workspaces (id, plan, created_at)
  values (v_ws, coalesce(p_plan, 'free'), now());

  -- Add creator as owner
  insert into public.workspace_members (workspace_id, user_id, role, status, created_at)
  values (v_ws, auth.uid(), 'owner', 'active', now());

  return v_ws;
end;
$$;


ALTER FUNCTION "public"."create_workspace_v1"("p_plan" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."db_logic_audit_v1"() RETURNS TABLE("object_type" "text", "object_name" "text", "status" "text", "details" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  /* ---------- Function existence checks (by exact signature) ---------- */
  -- Widget fetchers
  IF to_regprocedure('public.get_widget_config_v1(text)') IS NULL THEN
    RETURN QUERY SELECT 'function','get_widget_config_v1(text)','MISSING','required widget fetcher';
  END IF;

  IF to_regprocedure('public.get_widget_instance_v1(text)') IS NULL THEN
    RETURN QUERY SELECT 'function','get_widget_instance_v1(text)','MISSING','required widget instance fetcher';
  END IF;

  -- Token-gated fetchers
  IF to_regprocedure('public.get_widget_config_with_token_v1(text,text)') IS NULL THEN
    RETURN QUERY SELECT 'function','get_widget_config_with_token_v1(text,text)','MISSING','token-gated widget fetcher';
  END IF;

  IF to_regprocedure('public.get_widget_instance_with_token_v1(text,text)') IS NULL THEN
    RETURN QUERY SELECT 'function','get_widget_instance_with_token_v1(text,text)','MISSING','token-gated instance fetcher';
  END IF;

  -- Oslo token lifecycle
  IF to_regprocedure('public.issue_oslo_token_v1(uuid,integer,uuid)') IS NULL THEN
    RETURN QUERY SELECT 'function','issue_oslo_token_v1(uuid,integer,uuid)','MISSING','token issue (by widget_instance_id)';
  END IF;

  IF to_regprocedure('public.issue_oslo_token_for_public_id_v1(text,integer,uuid)') IS NULL THEN
    RETURN QUERY SELECT 'function','issue_oslo_token_for_public_id_v1(text,integer,uuid)','MISSING','token issue (by public_id)';
  END IF;

  IF to_regprocedure('public.rotate_oslo_token_v1(text,integer)') IS NULL THEN
    RETURN QUERY SELECT 'function','rotate_oslo_token_v1(text,integer)','MISSING','token rotate';
  END IF;

  IF to_regprocedure('public.revoke_oslo_token_v1(text)') IS NULL THEN
    RETURN QUERY SELECT 'function','revoke_oslo_token_v1(text)','MISSING','token revoke';
  END IF;

  IF to_regprocedure('public.purge_oslo_tokens_expired_v1()') IS NULL THEN
    RETURN QUERY SELECT 'function','purge_oslo_tokens_expired_v1()','MISSING','purge expired tokens';
  END IF;

  IF to_regprocedure('public.oslo_token_audit_v1(uuid)') IS NULL THEN
    RETURN QUERY SELECT 'function','oslo_token_audit_v1(uuid)','MISSING','list active tokens for instance';
  END IF;

  -- Plugin artifacts / Venice
  IF to_regprocedure('public.register_plugin_artifact_v1(uuid,text,bytea)') IS NULL THEN
    RETURN QUERY SELECT 'function','register_plugin_artifact_v1(uuid,text,bytea)','MISSING','plugin artifact registry';
  END IF;

  IF to_regprocedure('public.get_latest_plugin_artifact_v1(uuid)') IS NULL THEN
    RETURN QUERY SELECT 'function','get_latest_plugin_artifact_v1(uuid)','MISSING','latest plugin artifact';
  END IF;

  -- Usage rollups / CI
  IF to_regprocedure('public.refresh_usage_monthly_rollup_v1()') IS NULL THEN
    RETURN QUERY SELECT 'function','refresh_usage_monthly_rollup_v1()','MISSING','rollup refresh';
  END IF;

  IF to_regprocedure('public.test_usage_baseline_v1(timestamptz)') IS NULL THEN
    RETURN QUERY SELECT 'function','test_usage_baseline_v1(timestamptz)','MISSING','rollup vs events validator';
  END IF;

  IF to_regprocedure('public.purge_usage_events_v1(timestamptz)') IS NULL THEN
    RETURN QUERY SELECT 'function','purge_usage_events_v1(timestamptz)','MISSING','usage retention purge';
  END IF;

  IF to_regprocedure('public.retention_audit_v1(timestamptz)') IS NULL THEN
    RETURN QUERY SELECT 'function','retention_audit_v1(timestamptz)','MISSING','retention audit';
  END IF;

  IF to_regprocedure('public.db_schema_audit_v1()') IS NULL THEN
    RETURN QUERY SELECT 'function','db_schema_audit_v1()','MISSING','schema audit (tables/indexes)';
  END IF;

  /* ---------- Trigger function binding checks ---------- */
  -- We verify that each trigger function exists AND is bound to at least one trigger.
  -- If the function exists but has zero bindings in pg_trigger, we report UNBOUND.

  -- Helper: report UNBOUND if tgfoid join count = 0
  PERFORM 1
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname='public' AND p.proname='enforce_claim_rate_limit';
  IF FOUND THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger t
      JOIN pg_proc p2 ON p2.oid = t.tgfoid
      JOIN pg_namespace n2 ON n2.oid = p2.pronamespace
      WHERE n2.nspname='public' AND p2.proname='enforce_claim_rate_limit' AND NOT t.tgisinternal
    ) THEN
      RETURN QUERY SELECT 'trigger_fn','enforce_claim_rate_limit','UNBOUND','trigger function exists but not attached to any trigger';
    END IF;
  END IF;

  PERFORM 1
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname='public' AND p.proname='enforce_claimed_at_on_publish';
  IF FOUND THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger t
      JOIN pg_proc p2 ON p2.oid = t.tgfoid
      JOIN pg_namespace n2 ON n2.oid = p2.pronamespace
      WHERE n2.nspname='public' AND p2.proname='enforce_claimed_at_on_publish' AND NOT t.tgisinternal
    ) THEN
      RETURN QUERY SELECT 'trigger_fn','enforce_claimed_at_on_publish','UNBOUND','trigger function exists but not attached to any trigger';
    END IF;
  END IF;

  PERFORM 1
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname='public' AND p.proname='form_submissions_insert';
  IF FOUND THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger t
      JOIN pg_proc p2 ON p2.oid = t.tgfoid
      JOIN pg_namespace n2 ON n2.oid = p2.pronamespace
      WHERE n2.nspname='public' AND p2.proname='form_submissions_insert' AND NOT t.tgisinternal
    ) THEN
      RETURN QUERY SELECT 'trigger_fn','form_submissions_insert','UNBOUND','trigger function exists but not attached to any trigger';
    END IF;
  END IF;

  PERFORM 1
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname='public' AND p.proname='handle_new_user_created';
  IF FOUND THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger t
      JOIN pg_proc p2 ON p2.oid = t.tgfoid
      JOIN pg_namespace n2 ON n2.oid = p2.pronamespace
      WHERE n2.nspname='public' AND p2.proname='handle_new_user_created' AND NOT t.tgisinternal
    ) THEN
      RETURN QUERY SELECT 'trigger_fn','handle_new_user_created','UNBOUND','trigger function exists but not attached to any trigger';
    END IF;
  END IF;

  PERFORM 1
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname='public' AND p.proname='set_updated_at';
  IF FOUND THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger t
      JOIN pg_proc p2 ON p2.oid = t.tgfoid
      JOIN pg_namespace n2 ON n2.oid = p2.pronamespace
      WHERE n2.nspname='public' AND p2.proname='set_updated_at' AND NOT t.tgisinternal
    ) THEN
      RETURN QUERY SELECT 'trigger_fn','set_updated_at','UNBOUND','trigger function exists but not attached to any trigger';
    END IF;
  END IF;

  PERFORM 1
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname='public' AND p.proname='widget_submissions_trace_ai';
  IF FOUND THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger t
      JOIN pg_proc p2 ON p2.oid = t.tgfoid
      JOIN pg_namespace n2 ON n2.oid = p2.pronamespace
      WHERE n2.nspname='public' AND p2.proname='widget_submissions_trace_ai' AND NOT t.tgisinternal
    ) THEN
      RETURN QUERY SELECT 'trigger_fn','widget_submissions_trace_ai','UNBOUND','trigger function exists but not attached to any trigger';
    END IF;
  END IF;

  -- If we got here and emitted nothing, it's healthy
  RETURN;
END;
$$;


ALTER FUNCTION "public"."db_logic_audit_v1"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."db_schema_audit_v1"() RETURNS TABLE("object_type" "text", "object_name" "text", "status" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Check for required tables
  RETURN QUERY
  SELECT 'table', 'widget_instances', 'MISSING'
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'widget_instances'
  );

  RETURN QUERY
  SELECT 'table', 'widget_claim_audit', 'MISSING'
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'widget_claim_audit'
  );

  RETURN QUERY
  SELECT 'index', 'idx_widget_instances_public_published', 'MISSING'
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_widget_instances_public_published'
  );

  -- Extend with more core objects as needed
END;
$$;


ALTER FUNCTION "public"."db_schema_audit_v1"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_claim_rate_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_failures int;
BEGIN
  -- Only rate-limit failed attempts; allow success path to proceed/idempotency enforces single win
  IF NEW.success IS FALSE THEN
    SELECT COUNT(*) INTO v_failures
    FROM public.widget_claim_audit a
    WHERE a.user_id IS NOT DISTINCT FROM NEW.user_id
      AND a.widget_instance_id = NEW.widget_instance_id
      AND a.success = false
      AND a.claimed_at >= (now() - interval '5 minutes');

    IF v_failures >= 5 THEN
      RAISE EXCEPTION 'claim_rate_limited' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_claim_rate_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_claimed_at_on_publish"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- If the row is moving into 'published' and claimed_at is null, stamp it.
  IF NEW.status = 'published' AND COALESCE(NEW.claimed_at, TIMESTAMPTZ 'epoch') = TIMESTAMPTZ 'epoch' THEN
    NEW.claimed_at := now();
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_claimed_at_on_publish"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_limit_v1"("p_workspace_id" "uuid", "p_event_type" "text", "p_quantity" integer DEFAULT 1) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_plan TEXT;
  v_limit_value INTEGER;
  v_current_usage INTEGER;
  v_new_usage INTEGER;
BEGIN
  -- Get workspace plan
  SELECT plan INTO v_plan
  FROM workspaces
  WHERE id = p_workspace_id;

  -- For demo: hardcode plan limits (later: table-driven)
  IF v_plan = 'free' THEN
    v_limit_value := 1000;
  ELSE
    v_limit_value := -1; -- unlimited
  END IF;

  -- Count usage this month
  SELECT COALESCE(SUM(quantity),0) INTO v_current_usage
  FROM usage_events
  WHERE workspace_id = p_workspace_id
    AND event_type = p_event_type
    AND created_at >= date_trunc('month', now());

  v_new_usage := v_current_usage + p_quantity;

  -- Log this event
  INSERT INTO usage_events (workspace_id, event_type, quantity)
  VALUES (p_workspace_id, p_event_type, p_quantity);

  -- Return result
  RETURN jsonb_build_object(
    'allowed', (v_limit_value = -1 OR v_new_usage <= v_limit_value),
    'usage', v_new_usage,
    'limit', v_limit_value
  );
END;
$$;


ALTER FUNCTION "public"."enforce_limit_v1"("p_workspace_id" "uuid", "p_event_type" "text", "p_quantity" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_submission_rate_limit_by_token_v1"("p_token" "text", "p_now" timestamp with time zone DEFAULT "now"(), "p_limit" integer DEFAULT 60) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_token_id uuid;
BEGIN
  SELECT public.get_token_id_from_string_v1(p_token) INTO v_token_id;
  IF v_token_id IS NULL THEN
    RAISE EXCEPTION 'invalid_or_expired_token';
  END IF;

  PERFORM public.enforce_submission_rate_limit_v1(v_token_id, p_now, p_limit);
END;
$$;


ALTER FUNCTION "public"."enforce_submission_rate_limit_by_token_v1"("p_token" "text", "p_now" timestamp with time zone, "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_submission_rate_limit_v1"("p_token_id" "uuid", "p_now" timestamp with time zone DEFAULT "now"(), "p_limit" integer DEFAULT 60) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_bucket timestamptz := date_trunc('minute', p_now);
  v_count int;
BEGIN
  INSERT INTO public.submission_rate_window (token_id, bucket_start, count)
  VALUES (p_token_id, v_bucket, 1)
  ON CONFLICT (token_id, bucket_start)
  DO UPDATE SET count = public.submission_rate_window.count + 1
  RETURNING count INTO v_count;

  IF v_count > p_limit THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;
END;
$$;


ALTER FUNCTION "public"."enforce_submission_rate_limit_v1"("p_token_id" "uuid", "p_now" timestamp with time zone, "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."form_submissions_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.widget_submissions (widget_id, payload, ip, ua)
  VALUES (NEW.widget_id, NEW.payload, NEW.ip, NEW.ua);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."form_submissions_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_feature_flag_v1"("p_workspace_id" "uuid", "p_feature_key" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_enabled BOOLEAN := false;
  v_variant TEXT := NULL;
BEGIN
  SELECT ff.enabled, ff.variant
    INTO v_enabled, v_variant
  FROM public.feature_flags ff
  WHERE ff.workspace_id = p_workspace_id
    AND ff.feature_key  = p_feature_key
  LIMIT 1;

  RETURN jsonb_build_object(
    'enabled', COALESCE(v_enabled, false),
    'variant', v_variant
  );
END;
$$;


ALTER FUNCTION "public"."get_feature_flag_v1"("p_workspace_id" "uuid", "p_feature_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_feature_flags_v1"("p_workspace_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid    uuid;
  v_result jsonb;
begin
  -- Who's calling?
  v_uid := auth.uid();

  -- 1) If called from app (has JWT): require membership
  if v_uid is not null then
    if not public.is_workspace_member(v_uid, p_workspace_id) then
      raise exception 'forbidden';
    end if;

  -- 2) If called from SQL editor as postgres: allow read only for testing
  elsif current_user = 'postgres' then
    -- proceed without membership check (editor-only)
    null;

  -- 3) Anyone else: block
  else
    raise exception 'not_authenticated';
  end if;

  -- Return flags
  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'feature_key', feature_key,
               'enabled',     enabled,
               'variant',     variant,
               'updated_at',  updated_at
             )
             order by feature_key
           ),
           '[]'::jsonb
         )
    into v_result
  from public.feature_flags
  where workspace_id = p_workspace_id;

  return v_result;
end
$$;


ALTER FUNCTION "public"."get_feature_flags_v1"("p_workspace_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_latest_plugin_artifact_v1"("p_widget_id" "uuid") RETURNS TABLE("artifact_id" "uuid", "version" "text", "bytes" integer, "created_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT pa.id, pa.version, pa.bytes, pa.created_at
  FROM public.plugin_artifacts pa
  WHERE pa.widget_id = p_widget_id
  ORDER BY pa.created_at DESC
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_latest_plugin_artifact_v1"("p_widget_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_submission_trace_by_public_id"("p_public_id" "text", "p_limit" integer DEFAULT 50) RETURNS TABLE("submission_id" "uuid", "widget_instance_public_id" "text", "widget_instance_uuid" "uuid", "instance_status" "text", "widget_id" "uuid", "workspace_id" "uuid", "event_type" "text", "event_time" timestamp with time zone, "submission_payload" "jsonb", "submission_ip" "text", "submission_ua" "text", "submission_ts" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    submission_id,
    widget_instance_public_id,
    widget_instance_uuid,
    instance_status,
    widget_id,
    workspace_id,
    event_type,
    event_time,
    submission_payload,
    submission_ip,
    submission_ua,
    submission_ts
  FROM public.submission_trace
  WHERE widget_instance_public_id = p_public_id
  ORDER BY event_time DESC NULLS LAST, submission_ts DESC NULLS LAST
  LIMIT p_limit
$$;


ALTER FUNCTION "public"."get_submission_trace_by_public_id"("p_public_id" "text", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_token_id_from_string_v1"("p_token" "text") RETURNS "uuid"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT id
  FROM public.embed_tokens
  WHERE token = p_token
    AND expires_at > now()
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_token_id_from_string_v1"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_widget_config_v1"("p_public_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_widget_instance_id uuid;
  v_widget_id          uuid;
  v_workspace_id       uuid;
  v_status             text;
  v_widget_type        text;
  v_public_key         text;
  v_widget_cfg         jsonb;
  v_instance_cfg       jsonb;
  v_merged_cfg         jsonb;
BEGIN
  SELECT
      wi.id,
      wi.widget_id,
      w.workspace_id,
      wi.status,
      w.type,
      w.public_key,
      w.config,
      wi.config
    INTO
      v_widget_instance_id,
      v_widget_id,
      v_workspace_id,
      v_status,
      v_widget_type,
      v_public_key,
      v_widget_cfg,
      v_instance_cfg
  FROM public.widget_instances wi
  JOIN public.widgets w ON w.id = wi.widget_id
  WHERE wi.public_id = p_public_id
    AND wi.status    = 'published'
  LIMIT 1;

  IF v_widget_instance_id IS NULL THEN
    -- Log the failed attempt
    INSERT INTO public.widget_fetch_errors(public_id, error_code, error_message)
    VALUES (p_public_id, 'not_found_or_unpublished', 'Widget instance not found or not published');
    RAISE EXCEPTION 'not_found_or_unpublished' USING ERRCODE = 'P0001';
  END IF;

  v_merged_cfg := coalesce(v_widget_cfg, '{}'::jsonb) || coalesce(v_instance_cfg, '{}'::jsonb);

  RETURN jsonb_build_object(
    'public_id',            p_public_id,
    'widget_instance_uuid', v_widget_instance_id,
    'widget_uuid',          v_widget_id,
    'workspace_id',         v_workspace_id,
    'widget_type',          v_widget_type,
    'public_key',           v_public_key,
    'status',               v_status,
    'config',               v_merged_cfg
  );
END;
$$;


ALTER FUNCTION "public"."get_widget_config_v1"("p_public_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_widget_config_with_token_v1"("p_public_id" "text", "p_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_widget_instance_uuid uuid;
  v_widget_id uuid;
  v_workspace_id uuid;
  v_status text;
  v_widget_type text;
  v_public_key text;
  v_widget_cfg jsonb;
  v_instance_cfg jsonb;
  v_merged_cfg jsonb;
BEGIN
  SELECT ot.widget_instance_id
    INTO v_widget_instance_uuid
  FROM public.oslo_tokens ot
  WHERE ot.token = p_token
    AND ot.expires_at > now()
  LIMIT 1;

  IF v_widget_instance_uuid IS NULL THEN
    INSERT INTO public.widget_fetch_errors(public_id, error_code, error_message)
    VALUES (p_public_id, 'invalid_or_expired_token', 'Oslo token missing, invalid, or expired');
    RAISE EXCEPTION 'invalid_or_expired_token' USING ERRCODE = 'P0001';
  END IF;

  SELECT
      wi.id,
      wi.widget_id,
      w.workspace_id,
      wi.status,
      w.type,
      w.public_key,
      w.config,
      wi.config
    INTO
      v_widget_instance_uuid,
      v_widget_id,
      v_workspace_id,
      v_status,
      v_widget_type,
      v_public_key,
      v_widget_cfg,
      v_instance_cfg
  FROM public.widget_instances wi
  JOIN public.widgets w ON w.id = wi.widget_id
  WHERE wi.id        = v_widget_instance_uuid
    AND wi.public_id = p_public_id
    AND wi.status    IN ('draft','inactive','published')
  LIMIT 1;

  IF v_widget_instance_uuid IS NULL THEN
    INSERT INTO public.widget_fetch_errors(public_id, error_code, error_message)
    VALUES (p_public_id, 'not_found_or_mismatch', 'Token instance mismatch, not found, or status invalid');
    RAISE EXCEPTION 'not_found_or_mismatch' USING ERRCODE = 'P0001';
  END IF;

  v_merged_cfg := coalesce(v_widget_cfg, '{}'::jsonb) || coalesce(v_instance_cfg, '{}'::jsonb);

  RETURN jsonb_build_object(
    'public_id',            p_public_id,
    'widget_instance_uuid', v_widget_instance_uuid,
    'widget_uuid',          v_widget_id,
    'workspace_id',         v_workspace_id,
    'widget_type',          v_widget_type,
    'public_key',           v_public_key,
    'status',               v_status,
    'config',               v_merged_cfg
  );
END;
$$;


ALTER FUNCTION "public"."get_widget_config_with_token_v1"("p_public_id" "text", "p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_widget_instance_v1"("p_public_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_widget_instance_id uuid;
  v_widget_id          uuid;
  v_workspace_id       uuid;
  v_status             text;
BEGIN
  SELECT
      wi.id,
      wi.widget_id,
      w.workspace_id,
      wi.status
    INTO
      v_widget_instance_id,
      v_widget_id,
      v_workspace_id,
      v_status
  FROM public.widget_instances wi
  JOIN public.widgets w ON w.id = wi.widget_id
  WHERE wi.public_id = p_public_id
    AND wi.status    = 'published'
  LIMIT 1;

  IF v_widget_instance_id IS NULL THEN
    -- DB-only instrumentation: record failed lookup
    INSERT INTO public.widget_fetch_errors(public_id, error_code, error_message)
    VALUES (p_public_id, 'not_found', 'Widget instance not found or not published');
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object(
    'public_id',            p_public_id,
    'widget_instance_uuid', v_widget_instance_id,
    'widget_uuid',          v_widget_id,
    'workspace_id',         v_workspace_id,
    'instance_status',      v_status
  );
END;
$$;


ALTER FUNCTION "public"."get_widget_instance_v1"("p_public_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_widget_instance_with_token_v1"("p_public_id" "text", "p_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_widget_instance_uuid uuid;
  v_widget_id uuid;
  v_workspace_id uuid;
  v_status text;
BEGIN
  SELECT ot.widget_instance_id
    INTO v_widget_instance_uuid
  FROM public.oslo_tokens ot
  WHERE ot.token = p_token
    AND ot.expires_at > now()
  LIMIT 1;

  IF v_widget_instance_uuid IS NULL THEN
    INSERT INTO public.widget_fetch_errors(public_id, error_code, error_message)
    VALUES (p_public_id, 'invalid_or_expired_token', 'Oslo token missing, invalid, or expired');
    RAISE EXCEPTION 'invalid_or_expired_token' USING ERRCODE = 'P0001';
  END IF;

  SELECT
      wi.id,
      wi.widget_id,
      w.workspace_id,
      wi.status
    INTO
      v_widget_instance_uuid,
      v_widget_id,
      v_workspace_id,
      v_status
  FROM public.widget_instances wi
  JOIN public.widgets w ON w.id = wi.widget_id
  WHERE wi.id        = v_widget_instance_uuid
    AND wi.public_id = p_public_id
    AND wi.status    IN ('draft','inactive','published')
  LIMIT 1;

  IF v_widget_instance_uuid IS NULL THEN
    INSERT INTO public.widget_fetch_errors(public_id, error_code, error_message)
    VALUES (p_public_id, 'not_found_or_mismatch', 'Token instance mismatch, not found, or status invalid');
    RAISE EXCEPTION 'not_found_or_mismatch' USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object(
    'public_id',            p_public_id,
    'widget_instance_uuid', v_widget_instance_uuid,
    'widget_uuid',          v_widget_id,
    'workspace_id',         v_workspace_id,
    'instance_status',      v_status
  );
END;
$$;


ALTER FUNCTION "public"."get_widget_instance_with_token_v1"("p_public_id" "text", "p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user_created"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_source user_created_source := 'signup_form';
  v_creator UUID := NULL;
  v_ip INET := NULL;
  v_ua TEXT := NULL;
BEGIN
  -- Pull optional hints from raw_user_meta_data set at signup
  IF NEW.raw_user_meta_data ? 'created_source' THEN
    v_source := COALESCE((NEW.raw_user_meta_data->>'created_source')::user_created_source, 'signup_form');
  END IF;

  IF NEW.raw_user_meta_data ? 'created_by' THEN
    v_creator := (NEW.raw_user_meta_data->>'created_by')::uuid;
  END IF;

  IF NEW.raw_user_meta_data ? 'created_ip' THEN
    v_ip := (NEW.raw_user_meta_data->>'created_ip')::inet;
  END IF;

  IF NEW.raw_user_meta_data ? 'created_user_agent' THEN
    v_ua := NEW.raw_user_meta_data->>'created_user_agent';
  END IF;

  -- Upsert into profiles so we always have a row
  INSERT INTO public.profiles (user_id, created_at, created_by, created_source, created_ip, created_user_agent)
  VALUES (NEW.id, now(), v_creator, v_source, v_ip, v_ua)
  ON CONFLICT (user_id) DO UPDATE
    SET created_by        = EXCLUDED.created_by,
        created_source    = EXCLUDED.created_source,
        created_ip        = COALESCE(EXCLUDED.created_ip, public.profiles.created_ip),
        created_user_agent= COALESCE(EXCLUDED.created_user_agent, public.profiles.created_user_agent);

  -- Write an immutable audit event
  INSERT INTO public.user_creation_audit (user_id, created_by, created_source, created_ip, created_user_agent, raw_meta)
  VALUES (NEW.id, v_creator, v_source, v_ip, v_ua, NEW.raw_user_meta_data);

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user_created"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ingest_submission_v1"("p_public_id" "text", "p_payload" "jsonb", "p_ip" "text", "p_ua" "text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_submission_id uuid;
  v_widget_id uuid;
  v_widget_instance_id text;
  v_workspace_id uuid;
  v_status text;
  v_instance_uuid uuid;
BEGIN
  SELECT w.id,
         wi.public_id,
         w.workspace_id,
         wi.status,
         wi.id
    INTO v_widget_id,
         v_widget_instance_id,
         v_workspace_id,
         v_status,
         v_instance_uuid
  FROM public.widget_instances wi
  JOIN public.widgets w ON w.id = wi.widget_id
  WHERE wi.public_id = p_public_id
    AND wi.status IN ('draft','inactive','published')
  LIMIT 1;

  IF v_widget_id IS NULL THEN
    RAISE EXCEPTION 'Widget instance not found for public_id %', p_public_id;
  END IF;

  INSERT INTO public.widget_submissions (id, widget_id, widget_instance_id, payload, ip, ua, ts)
  VALUES (gen_random_uuid(), v_widget_id, v_widget_instance_id, COALESCE(p_payload, '{}'::jsonb), p_ip, p_ua, now())
  RETURNING id INTO v_submission_id;

  INSERT INTO public.events (workspace_id, entity_type, entity_id, event_type, payload, idempotency_hash)
  VALUES (
    v_workspace_id,
    'widget_submission',
    v_submission_id,
    'widget.submission.created',
    jsonb_build_object('widget_instance_id', v_widget_instance_id, 'ip', p_ip, 'ua', p_ua),
    NULL
  );

  RETURN v_submission_id;
END;
$$;


ALTER FUNCTION "public"."ingest_submission_v1"("p_public_id" "text", "p_payload" "jsonb", "p_ip" "text", "p_ua" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_form_submission"("p_widget_instance_id" "text", "p_payload" "jsonb", "p_ip" "inet", "p_ua" "text") RETURNS TABLE("id" "uuid", "widget_id" "uuid", "widget_instance_id" "text", "payload" "jsonb", "ip" "inet", "ua" "text", "ts" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_widget_id uuid;
  v_public_id text;
  v_payload jsonb := COALESCE(p_payload, '{}'::jsonb);
  v_inserted_id uuid;
BEGIN
  SELECT wi.widget_id, wi.public_id
    INTO v_widget_id, v_public_id
  FROM public.widget_instances wi
  WHERE wi.public_id = p_widget_instance_id
    AND wi.status IN ('draft','inactive','published')
  LIMIT 1;

  IF v_widget_id IS NULL THEN
    RAISE EXCEPTION 'Widget instance not found or unavailable: %', p_widget_instance_id;
  END IF;

  INSERT INTO public.widget_submissions (widget_id, widget_instance_id, payload, ip, ua)
  VALUES (v_widget_id, v_public_id, v_payload, p_ip, p_ua)
  RETURNING public.widget_submissions.id INTO v_inserted_id;

  RETURN QUERY
  SELECT
    v_inserted_id,
    v_widget_id,
    v_public_id,
    v_payload,
    p_ip,
    p_ua,
    now();
END;
$$;


ALTER FUNCTION "public"."insert_form_submission"("p_widget_instance_id" "text", "p_payload" "jsonb", "p_ip" "inet", "p_ua" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_workspace_member"("p_workspace_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members m
    WHERE m.workspace_id = p_workspace_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'
  );
$$;


ALTER FUNCTION "public"."is_workspace_member"("p_workspace_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_workspace_owner"("p_workspace_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members m
    WHERE m.workspace_id = p_workspace_id
      AND m.user_id = auth.uid()
      AND m.role = 'owner'
      AND m.status = 'active'
  );
$$;


ALTER FUNCTION "public"."is_workspace_owner"("p_workspace_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."embed_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "widget_instance_id" "uuid" NOT NULL,
    "token" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "rotated_at" timestamp with time zone
);


ALTER TABLE "public"."embed_tokens" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."issue_embed_token_for_public_id_v1"("p_public_id" "text", "p_ttl_minutes" integer, "p_created_by" "uuid" DEFAULT NULL::"uuid") RETURNS "public"."embed_tokens"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  v_instance_id uuid;
BEGIN
  SELECT wi.id INTO v_instance_id
  FROM public.widget_instances wi
  WHERE wi.public_id = p_public_id;

  IF v_instance_id IS NULL THEN
    RAISE EXCEPTION 'widget_instance_not_found';
  END IF;

  RETURN public.issue_embed_token_v1(v_instance_id, p_ttl_minutes, p_created_by);
END;
$$;


ALTER FUNCTION "public"."issue_embed_token_for_public_id_v1"("p_public_id" "text", "p_ttl_minutes" integer, "p_created_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."issue_embed_token_v1"("p_widget_instance_id" "uuid", "p_ttl_minutes" integer, "p_created_by" "uuid" DEFAULT NULL::"uuid") RETURNS "public"."embed_tokens"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  v_workspace_id uuid;
  v_row public.embed_tokens;
BEGIN
  SELECT w.workspace_id INTO v_workspace_id
  FROM public.widget_instances wi
  JOIN public.widgets w ON w.id = wi.widget_id
  WHERE wi.id = p_widget_instance_id;

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'widget_instance_not_found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members m
    WHERE m.workspace_id = v_workspace_id AND m.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  INSERT INTO public.embed_tokens (widget_instance_id, token, expires_at, created_at, created_by)
  VALUES (
    p_widget_instance_id,
    'et_' || encode(gen_random_bytes(32), 'hex'),
    now() + make_interval(mins => p_ttl_minutes),
    now(),
    COALESCE(p_created_by, auth.uid())
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;


ALTER FUNCTION "public"."issue_embed_token_v1"("p_widget_instance_id" "uuid", "p_ttl_minutes" integer, "p_created_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."issue_oslo_token_for_public_id_v1"("p_public_id" "text", "p_ttl_minutes" integer, "p_created_by" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("out_token" "text", "out_widget_instance_id" "uuid", "out_expires_at" timestamp with time zone, "out_created_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_widget_instance_id uuid;
  v_token text;
BEGIN
  IF p_ttl_minutes IS NULL OR p_ttl_minutes <= 0 THEN
    RAISE EXCEPTION 'ttl_minutes_must_be_positive' USING ERRCODE = 'P0001';
  END IF;

  SELECT wi.id
    INTO v_widget_instance_id
  FROM public.widget_instances wi
  WHERE wi.public_id = p_public_id
    AND wi.status    = 'published'
  LIMIT 1;

  IF v_widget_instance_id IS NULL THEN
    RAISE EXCEPTION 'public_id_not_found_or_unpublished' USING ERRCODE = 'P0001';
  END IF;

  v_token := gen_random_uuid()::text;

  INSERT INTO public.oslo_tokens (widget_instance_id, token, expires_at, created_at, created_by)
  VALUES (v_widget_instance_id, v_token, now() + make_interval(mins => p_ttl_minutes), now(), p_created_by)
  RETURNING token, widget_instance_id, expires_at, created_at
  INTO out_token, out_widget_instance_id, out_expires_at, out_created_at;

  RETURN;
END;
$$;


ALTER FUNCTION "public"."issue_oslo_token_for_public_id_v1"("p_public_id" "text", "p_ttl_minutes" integer, "p_created_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."issue_oslo_token_v1"("p_widget_instance_id" "uuid", "p_ttl_minutes" integer, "p_created_by" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("out_token" "text", "out_widget_instance_id" "uuid", "out_expires_at" timestamp with time zone, "out_created_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_token text;
  v_exists boolean;
BEGIN
  IF p_ttl_minutes IS NULL OR p_ttl_minutes <= 0 THEN
    RAISE EXCEPTION 'ttl_minutes_must_be_positive' USING ERRCODE = 'P0001';
  END IF;

  -- Pre-validate FK target and require published status
  SELECT TRUE
    INTO v_exists
  FROM public.widget_instances wi
  WHERE wi.id = p_widget_instance_id
    AND wi.status = 'published'
  LIMIT 1;

  IF NOT COALESCE(v_exists, FALSE) THEN
    RAISE EXCEPTION 'widget_instance_not_found_or_unpublished' USING ERRCODE = 'P0001';
  END IF;

  v_token := gen_random_uuid()::text;

  INSERT INTO public.oslo_tokens (widget_instance_id, token, expires_at, created_at, created_by)
  VALUES (p_widget_instance_id, v_token, now() + make_interval(mins => p_ttl_minutes), now(), p_created_by)
  RETURNING token, widget_instance_id, expires_at, created_at
  INTO out_token, out_widget_instance_id, out_expires_at, out_created_at;

  RETURN;
END;
$$;


ALTER FUNCTION "public"."issue_oslo_token_v1"("p_widget_instance_id" "uuid", "p_ttl_minutes" integer, "p_created_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."issue_widget_draft_token_v1"("p_widget_instance_id" "uuid", "p_ttl_minutes" integer DEFAULT 1440) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_now timestamptz := now();
  v_token uuid;
  v_expires timestamptz;
  v_row RECORD;
BEGIN
  -- Fetch current state
  SELECT id, draft_token, claimed_at, expires_at, status
  INTO v_row
  FROM public.widget_instances
  WHERE id = p_widget_instance_id
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  -- If already claimed, do not issue a token
  IF v_row.claimed_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_claimed');
  END IF;

  -- If a non-expired token exists, return it as-is (idempotent)
  IF v_row.draft_token IS NOT NULL AND (v_row.expires_at IS NULL OR v_row.expires_at > v_now) THEN
    RETURN jsonb_build_object(
      'success', true,
      'widget_instance_id', p_widget_instance_id,
      'draft_token', v_row.draft_token,
      'expires_at', v_row.expires_at
    );
  END IF;

  -- Create a fresh token
  v_token   := gen_random_uuid();
  v_expires := v_now + make_interval(mins => COALESCE(p_ttl_minutes, 1440));

  UPDATE public.widget_instances
     SET draft_token = v_token,
         expires_at  = v_expires
   WHERE id = p_widget_instance_id;

  -- Emit event
  INSERT INTO public.events (workspace_id, entity_type, entity_id, event_type, payload, created_at)
  SELECT w.workspace_id, 'widget_instance', wi.id, 'widget_instance.draft_issued',
         jsonb_build_object('expires_at', v_expires),
         v_now
  FROM public.widget_instances wi
  JOIN public.widgets w ON w.id = wi.widget_id
  WHERE wi.id = p_widget_instance_id;

  RETURN jsonb_build_object(
    'success', true,
    'widget_instance_id', p_widget_instance_id,
    'draft_token', v_token,
    'expires_at', v_expires
  );
END;
$$;


ALTER FUNCTION "public"."issue_widget_draft_token_v1"("p_widget_instance_id" "uuid", "p_ttl_minutes" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ops_health_snapshot_v1"() RETURNS TABLE("last_rollup_refresh" timestamp with time zone, "rollup_size" "text", "errors_24h" bigint, "expired_tokens" bigint, "usage_events_30d" bigint)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  WITH roll AS (
    SELECT h.last_refresh, h.total_size
    FROM public.usage_monthly_rollup_health_v1 h
    LIMIT 1
  ),
  err AS (
    SELECT COUNT(*)::bigint AS c
    FROM public.widget_fetch_errors e
    WHERE e.created_at >= now() - interval '24 hours'
  ),
  tok AS (
    SELECT COUNT(*)::bigint AS c
    FROM public.oslo_tokens t
    WHERE t.expires_at <= now()
  ),
  ue AS (
    SELECT COUNT(*)::bigint AS c
    FROM public.usage_events u
    WHERE u.created_at >= now() - interval '30 days'
  )
  SELECT
    (SELECT r.last_refresh FROM roll r) AS last_rollup_refresh,
    (SELECT r.total_size  FROM roll r) AS rollup_size,
    COALESCE((SELECT e.c FROM err e), 0)::bigint AS errors_24h,
    COALESCE((SELECT t.c FROM tok t), 0)::bigint AS expired_tokens,
    COALESCE((SELECT u.c FROM ue u), 0)::bigint AS usage_events_30d;
END;
$$;


ALTER FUNCTION "public"."ops_health_snapshot_v1"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ops_refresh_rollups_v1"() RETURNS TABLE("view_name" "text", "last_refresh" timestamp with time zone, "total_size" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  PERFORM public.refresh_usage_monthly_rollup_v1();

  RETURN QUERY
  SELECT h.view_name, h.last_refresh, h.total_size
  FROM public.usage_monthly_rollup_health_v1 h;
END;
$$;


ALTER FUNCTION "public"."ops_refresh_rollups_v1"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ops_run_retention_core_v1"("p_errors_cutoff" interval, "p_usage_cutoff" interval) RETURNS TABLE("object" "text", "purged_rows" integer)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_err integer := 0;
  v_use integer := 0;
  v_tok integer := 0;
BEGIN
  -- widget_fetch_errors
  IF to_regclass('public.widget_fetch_errors') IS NOT NULL THEN
    v_err := public.purge_widget_fetch_errors_v1(now() - p_errors_cutoff);
    RETURN QUERY SELECT 'widget_fetch_errors'::text, v_err;
  END IF;

  -- usage_events
  IF to_regclass('public.usage_events') IS NOT NULL THEN
    v_use := public.purge_usage_events_v1(now() - p_usage_cutoff);
    RETURN QUERY SELECT 'usage_events'::text, v_use;
  END IF;

  -- oslo_tokens (expired)
  IF to_regclass('public.oslo_tokens') IS NOT NULL THEN
    v_tok := public.purge_oslo_tokens_expired_v1();
    RETURN QUERY SELECT 'oslo_tokens_expired'::text, v_tok;
  END IF;

  RETURN;
END;
$$;


ALTER FUNCTION "public"."ops_run_retention_core_v1"("p_errors_cutoff" interval, "p_usage_cutoff" interval) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ops_run_retention_v1"() RETURNS TABLE("object" "text", "purged_rows" integer)
    LANGUAGE "sql"
    AS $$
  SELECT * FROM public.ops_run_retention_core_v1(interval '30 days', interval '180 days');
$$;


ALTER FUNCTION "public"."ops_run_retention_v1"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ops_run_retention_v1"("p_errors_cutoff" interval, "p_usage_cutoff" interval) RETURNS TABLE("object" "text", "purged_rows" integer)
    LANGUAGE "sql"
    AS $$
  SELECT * FROM public.ops_run_retention_core_v1(p_errors_cutoff, p_usage_cutoff);
$$;


ALTER FUNCTION "public"."ops_run_retention_v1"("p_errors_cutoff" interval, "p_usage_cutoff" interval) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."oslo_token_audit_v1"("p_widget_instance_id" "uuid") RETURNS TABLE("token" "text", "widget_instance_id" "uuid", "expires_at" timestamp with time zone, "created_at" timestamp with time zone, "minutes_to_expiry" integer)
    LANGUAGE "sql"
    AS $$
  SELECT
    ot.token,
    ot.widget_instance_id,
    ot.expires_at,
    ot.created_at,
    GREATEST(0, CEIL(EXTRACT(EPOCH FROM (ot.expires_at - now())) / 60.0))::integer AS minutes_to_expiry
  FROM public.oslo_tokens ot
  WHERE ot.widget_instance_id = p_widget_instance_id
    AND ot.expires_at > now()
  ORDER BY ot.expires_at ASC;
$$;


ALTER FUNCTION "public"."oslo_token_audit_v1"("p_widget_instance_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_contact_submission_v1"("p_public_id" "text", "p_payload" "jsonb", "p_ip" "inet", "p_ua" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_widget_id     uuid;
  v_workspace_id  uuid;
  v_enabled       boolean;
  v_submission_id uuid;
BEGIN
  -- Resolve widget + workspace from the published widget_instance
  SELECT w.id, w.workspace_id
    INTO v_widget_id, v_workspace_id
  FROM public.widget_instances wi
  JOIN public.widgets w ON w.id = wi.widget_id
  WHERE wi.public_id = p_public_id
    AND wi.status    = 'published'
  LIMIT 1;

  IF v_widget_id IS NULL THEN
    RAISE EXCEPTION 'unknown_or_unpublished_widget_instance' USING ERRCODE = 'P0001';
  END IF;

  -- Feature flag: widgets.contact_form.enabled (default allow if not set)
  SELECT enabled
    INTO v_enabled
  FROM public.feature_flags
  WHERE workspace_id = v_workspace_id
    AND feature_key  = 'widgets.contact_form.enabled'
  ORDER BY updated_at DESC
  LIMIT 1;

  IF COALESCE(v_enabled, true) IS NOT TRUE THEN
    RAISE EXCEPTION 'feature_disabled' USING ERRCODE = 'P0001';
  END IF;

  -- Call canonical ingestion RPC
  v_submission_id := public.ingest_submission_v1(
    p_public_id,
    p_payload,
    p_ip::text,  -- cast inet -> text to match signature
    p_ua
  );

  -- Emit event (critical for audit/analytics/billing)
  INSERT INTO public.events (workspace_id, entity_type, entity_id, event_type, actor_id, payload, metadata)
  VALUES (
    v_workspace_id,
    'submission',
    v_submission_id,
    'submission.created',
    null,  -- no actor, anonymous
    p_payload,
    jsonb_build_object('ip', p_ip::text, 'ua', p_ua)
  );

  RETURN v_submission_id;
END;
$$;


ALTER FUNCTION "public"."process_contact_submission_v1"("p_public_id" "text", "p_payload" "jsonb", "p_ip" "inet", "p_ua" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_form_submission_v1"("p_widget_instance_id" "text", "p_payload" "jsonb", "p_ip" "inet", "p_ua" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_widget_id uuid;
  v_owner_user_id uuid;
  v_workspace_id uuid;
  v_public_id text;
  v_limit jsonb;
  v_submission_id uuid;
BEGIN
  SELECT w.id, w.user_id, wi.public_id
    INTO v_widget_id, v_owner_user_id, v_public_id
  FROM public.widget_instances wi
  JOIN public.widgets w ON w.id = wi.widget_id
  WHERE wi.public_id = p_widget_instance_id
    AND wi.status IN ('draft','inactive','published')
  LIMIT 1;

  IF v_widget_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_widget_instance');
  END IF;

  SELECT wm.workspace_id
    INTO v_workspace_id
  FROM public.workspace_members wm
  WHERE wm.user_id = v_owner_user_id
  ORDER BY wm.accepted_at DESC NULLS LAST,
           wm.invited_at  DESC NULLS LAST,
           wm.created_at  DESC
  LIMIT 1;

  IF v_workspace_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'workspace_missing_for_owner');
  END IF;

  SELECT public.check_feature_limit_v1(v_workspace_id, 'submissions')
    INTO v_limit;

  IF COALESCE((v_limit->>'allowed')::boolean, false) = false THEN
    RETURN jsonb_build_object('ok', false, 'error', 'limit_exceeded', 'usage', v_limit);
  END IF;

  SELECT id
    INTO v_submission_id
  FROM public.insert_form_submission(v_public_id, p_payload, p_ip, p_ua)
  LIMIT 1;

  PERFORM public.consume_feature_units_v1(v_workspace_id, 'submissions', 1);

  RETURN jsonb_build_object(
    'ok', true,
    'submission_id', v_submission_id,
    'usage', v_limit
  );
END;
$$;


ALTER FUNCTION "public"."process_form_submission_v1"("p_widget_instance_id" "text", "p_payload" "jsonb", "p_ip" "inet", "p_ua" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prune_submission_rate_windows_v1"("p_older_than" interval DEFAULT '01:00:00'::interval) RETURNS "void"
    LANGUAGE "sql"
    AS $$
  DELETE FROM public.submission_rate_window
  WHERE bucket_start < now() - p_older_than;
$$;


ALTER FUNCTION "public"."prune_submission_rate_windows_v1"("p_older_than" interval) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."purge_oslo_tokens_expired_v1"() RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_rows integer := 0;
BEGIN
  WITH del AS (
    DELETE FROM public.oslo_tokens
    WHERE expires_at <= now()
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_rows FROM del;

  RETURN v_rows;
END;
$$;


ALTER FUNCTION "public"."purge_oslo_tokens_expired_v1"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."purge_usage_events_v1"("p_cutoff" timestamp with time zone) RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_rows integer := 0;
BEGIN
  IF to_regclass('public.usage_events') IS NULL THEN
    RETURN 0;  -- table not present; nothing to purge
  END IF;

  WITH del AS (
    DELETE FROM public.usage_events ue
    WHERE ue.created_at < p_cutoff
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_rows FROM del;

  PERFORM pg_stat_statements_reset() WHERE false; -- no-op; placeholder to keep structure explicit
  PERFORM 1; -- explicit no-op

  RETURN v_rows;
END;
$$;


ALTER FUNCTION "public"."purge_usage_events_v1"("p_cutoff" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."purge_widget_fetch_errors_v1"("p_cutoff" timestamp with time zone) RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_rows integer := 0;
BEGIN
  IF to_regclass('public.widget_fetch_errors') IS NULL THEN
    RETURN 0;
  END IF;

  WITH del AS (
    DELETE FROM public.widget_fetch_errors e
    WHERE e.created_at < p_cutoff
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_rows FROM del;

  RETURN v_rows;
END;
$$;


ALTER FUNCTION "public"."purge_widget_fetch_errors_v1"("p_cutoff" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_usage_monthly_rollup_range_v1"("p_start" timestamp with time zone, "p_end" timestamp with time zone) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_month timestamptz;
BEGIN
  v_month := date_trunc('month', p_start);
  WHILE v_month <= date_trunc('month', p_end) LOOP
    PERFORM public.refresh_usage_monthly_rollup_v1();
    v_month := v_month + interval '1 month';
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."refresh_usage_monthly_rollup_range_v1"("p_start" timestamp with time zone, "p_end" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_usage_monthly_rollup_v1"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.usage_monthly_rollup;

  INSERT INTO public.materialized_view_refresh_log(view_name, refreshed_at)
  VALUES ('usage_monthly_rollup', now());
END;
$$;


ALTER FUNCTION "public"."refresh_usage_monthly_rollup_v1"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."register_plugin_artifact_v1"("p_widget_id" "uuid", "p_version" "text", "p_content" "bytea") RETURNS TABLE("artifact_id" "uuid", "widget_id" "uuid", "version" "text", "bytes" integer, "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Size gate (defense in depth; also enforced by the CHECK constraint)
  IF octet_length(p_content) > 28672 THEN
    RAISE EXCEPTION 'bundle_exceeds_28kb (% bytes)', octet_length(p_content)
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.plugin_artifacts (widget_id, version, content)
  VALUES (p_widget_id, p_version, p_content)
  RETURNING id, widget_id, version, bytes, created_at
  INTO artifact_id, widget_id, version, bytes, created_at;

  RETURN;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'duplicate_version_for_widget' USING ERRCODE = 'P0001';
END;
$$;


ALTER FUNCTION "public"."register_plugin_artifact_v1"("p_widget_id" "uuid", "p_version" "text", "p_content" "bytea") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."retention_audit_v1"("p_usage_cutoff" timestamp with time zone DEFAULT ("now"() - '180 days'::interval)) RETURNS TABLE("object" "text", "criterion" "text", "candidate_count" bigint)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- usage_events older than cutoff
  IF to_regclass('public.usage_events') IS NOT NULL THEN
    RETURN QUERY
    SELECT 'usage_events'::text AS object,
           format('created_at < %s', to_char(p_usage_cutoff, 'YYYY-MM-DD"T"HH24:MI:SSOF')) AS criterion,
           COUNT(*)::bigint
    FROM public.usage_events ue
    WHERE ue.created_at < p_usage_cutoff;
  END IF;

  -- oslo_tokens expired as of now
  IF to_regclass('public.oslo_tokens') IS NOT NULL THEN
    RETURN QUERY
    SELECT 'oslo_tokens'::text AS object,
           'expires_at <= now()'::text AS criterion,
           COUNT(*)::bigint
    FROM public.oslo_tokens ot
    WHERE ot.expires_at <= now();
  END IF;

  RETURN;
END;
$$;


ALTER FUNCTION "public"."retention_audit_v1"("p_usage_cutoff" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."revoke_embed_token_v1"("p_token_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_workspace_id uuid;
BEGIN
  SELECT w.workspace_id INTO v_workspace_id
  FROM public.embed_tokens et
  JOIN public.widget_instances wi ON wi.id = et.widget_instance_id
  JOIN public.widgets w ON w.id = wi.widget_id
  WHERE et.id = p_token_id;

  IF v_workspace_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members m
    WHERE m.workspace_id = v_workspace_id AND m.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  DELETE FROM public.embed_tokens WHERE id = p_token_id;
END;
$$;


ALTER FUNCTION "public"."revoke_embed_token_v1"("p_token_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."revoke_oslo_token_v1"("p_token" "text") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_rows integer := 0;
BEGIN
  WITH del AS (
    DELETE FROM public.oslo_tokens
    WHERE token = p_token
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_rows FROM del;

  RETURN v_rows;
END;
$$;


ALTER FUNCTION "public"."revoke_oslo_token_v1"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rotate_embed_token_v1"("p_token_id" "uuid", "p_ttl_minutes" integer) RETURNS "public"."embed_tokens"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  v_row public.embed_tokens;
  v_workspace_id uuid;
BEGIN
  SELECT w.workspace_id
    INTO v_workspace_id
  FROM public.embed_tokens et
  JOIN public.widget_instances wi ON wi.id = et.widget_instance_id
  JOIN public.widgets w ON w.id = wi.widget_id
  WHERE et.id = p_token_id;

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'token_not_found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members m
    WHERE m.workspace_id = v_workspace_id AND m.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  UPDATE public.embed_tokens et
     SET token      = 'et_' || encode(gen_random_bytes(32), 'hex'),
         expires_at = now() + make_interval(mins => p_ttl_minutes),
         rotated_at = now()
   WHERE et.id = p_token_id
  RETURNING et.* INTO v_row;

  RETURN v_row;
END;
$$;


ALTER FUNCTION "public"."rotate_embed_token_v1"("p_token_id" "uuid", "p_ttl_minutes" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rotate_oslo_token_v1"("p_old_token" "text", "p_ttl_minutes" integer) RETURNS TABLE("old_token" "text", "new_token" "text", "widget_instance_id" "uuid", "expires_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_widget_instance_id uuid;
  v_new_token          text;
  v_expires_at         timestamptz;
BEGIN
  IF p_ttl_minutes IS NULL OR p_ttl_minutes <= 0 THEN
    RAISE EXCEPTION 'ttl_minutes_must_be_positive' USING ERRCODE = 'P0001';
  END IF;

  -- Find the instance for the old token
  SELECT widget_instance_id
  INTO v_widget_instance_id
  FROM public.oslo_tokens
  WHERE token = p_old_token
  LIMIT 1;

  IF v_widget_instance_id IS NULL THEN
    RAISE EXCEPTION 'old_token_not_found' USING ERRCODE = 'P0001';
  END IF;

  -- Delete the old token
  PERFORM public.revoke_oslo_token_v1(p_old_token);

  -- Issue new token
  v_new_token := gen_random_uuid()::text;
  v_expires_at := now() + make_interval(mins => p_ttl_minutes);

  INSERT INTO public.oslo_tokens (widget_instance_id, token, expires_at)
  VALUES (v_widget_instance_id, v_new_token, v_expires_at);

  old_token := p_old_token;
  new_token := v_new_token;
  widget_instance_id := v_widget_instance_id;
  expires_at := v_expires_at;
  RETURN;
END;
$$;


ALTER FUNCTION "public"."rotate_oslo_token_v1"("p_old_token" "text", "p_ttl_minutes" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."run_performance_baseline_v1"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_start timestamptz;
  v_elapsed_ms numeric;
BEGIN
  -- Test 1: widget fetch
  v_start := clock_timestamp();
  PERFORM public.get_widget_instance_v1(public_id)
  FROM public.widget_instances
  WHERE status = 'published'
  LIMIT 1;
  v_elapsed_ms := EXTRACT(MILLISECOND FROM (clock_timestamp() - v_start));
  INSERT INTO public.performance_baseline_audit(test_name, duration_ms, status)
  VALUES ('widget_fetch', v_elapsed_ms, CASE WHEN v_elapsed_ms < 50 THEN 'PASS' ELSE 'FAIL' END);

  -- Test 2: submission ingest (dry run)
  v_start := clock_timestamp();
  PERFORM public.process_form_submission_v1(wi.public_id::text, '{}'::jsonb, '127.0.0.1', 'ua')
  FROM public.widget_instances wi
  WHERE wi.status = 'published'
  LIMIT 1;
  v_elapsed_ms := EXTRACT(MILLISECOND FROM (clock_timestamp() - v_start));
  INSERT INTO public.performance_baseline_audit(test_name, duration_ms, status)
  VALUES ('submission_ingest', v_elapsed_ms, CASE WHEN v_elapsed_ms < 100 THEN 'PASS' ELSE 'FAIL' END);

  -- Test 3: rollup refresh
  v_start := clock_timestamp();
  PERFORM public.refresh_usage_monthly_rollup_v1();
  v_elapsed_ms := EXTRACT(MILLISECOND FROM (clock_timestamp() - v_start));
  INSERT INTO public.performance_baseline_audit(test_name, duration_ms, status)
  VALUES ('rollup_refresh', v_elapsed_ms, CASE WHEN v_elapsed_ms < 200 THEN 'PASS' ELSE 'FAIL' END);
END;
$$;


ALTER FUNCTION "public"."run_performance_baseline_v1"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_feature_flag_v1"("p_workspace_id" "uuid", "p_feature_key" "text", "p_enabled" boolean, "p_variant" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Upsert into feature_flags
  INSERT INTO public.feature_flags (workspace_id, feature_key, enabled, variant, updated_at)
  VALUES (p_workspace_id, p_feature_key, p_enabled, p_variant, now())
  ON CONFLICT (workspace_id, feature_key)
  DO UPDATE SET
    enabled = EXCLUDED.enabled,
    variant = EXCLUDED.variant,
    updated_at = now();

  RETURN jsonb_build_object(
    'workspace_id', p_workspace_id,
    'feature_key', p_feature_key,
    'enabled', p_enabled,
    'variant', p_variant,
    'success', true
  );
END;
$$;


ALTER FUNCTION "public"."set_feature_flag_v1"("p_workspace_id" "uuid", "p_feature_key" "text", "p_enabled" boolean, "p_variant" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."test_usage_baseline_v1"("p_month" timestamp with time zone) RETURNS TABLE("workspace_id" "uuid", "feature_key" "text", "rollup_total" bigint, "event_total" bigint, "status" "text")
    LANGUAGE "sql"
    AS $$
  WITH raw AS (
    SELECT
      ue.workspace_id,
      ue.feature_key,
      SUM(COALESCE(ue.quantity,1))::bigint AS event_total
    FROM public.usage_events ue
    WHERE date_trunc('month', ue.created_at) = date_trunc('month', p_month)
      AND (ue.event_type = 'feature_usage' OR ue.event_type IS NULL)
    GROUP BY ue.workspace_id, ue.feature_key
  ),
  roll AS (
    SELECT
      ur.workspace_id,
      ur.feature_key,
      ur.month_total AS rollup_total
    FROM public.usage_monthly_rollup ur
    WHERE ur.month = date_trunc('month', p_month)
  )
  SELECT
    COALESCE(r.workspace_id, ro.workspace_id) AS workspace_id,
    COALESCE(r.feature_key, ro.feature_key)   AS feature_key,
    ro.rollup_total,
    r.event_total,
    CASE
      WHEN ro.rollup_total = r.event_total THEN 'OK'
      ELSE 'MISMATCH'
    END AS status
  FROM raw r
  FULL OUTER JOIN roll ro
    ON r.workspace_id = ro.workspace_id AND r.feature_key = ro.feature_key;
$$;


ALTER FUNCTION "public"."test_usage_baseline_v1"("p_month" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."usage_rollup_audit_v1"("p_month" timestamp with time zone) RETURNS TABLE("workspace_id" "uuid", "feature_key" "text", "rollup_total" bigint, "event_total" bigint, "status" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT r.workspace_id,
         r.feature_key,
         r.rollup_total,
         r.event_total,
         CASE WHEN r.rollup_total = r.event_total THEN 'OK' ELSE 'MISMATCH' END
  FROM public.test_usage_baseline_v1(p_month) r
  WHERE r.rollup_total IS DISTINCT FROM r.event_total;
END;
$$;


ALTER FUNCTION "public"."usage_rollup_audit_v1"("p_month" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."widget_submissions_fill_derived_v1"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
  NEW.payload_hash := encode(digest(NEW.payload::text, 'sha256'), 'hex');
  NEW.ts_second    := date_trunc('second', NEW.ts);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."widget_submissions_fill_derived_v1"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."widget_submissions_trace_ai"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.submission_trace (
      submission_id,
      widget_instance_public_id,
      widget_instance_uuid,
      instance_status,
      widget_id,
      workspace_id,
      event_type,
      event_time,
      submission_payload,
      submission_ip,
      submission_ua,
      submission_ts
  )
  SELECT
      NEW.id                                 AS submission_id,
      NEW.widget_instance_id                 AS widget_instance_public_id,  -- this is the public_id (text)
      wi.id                                  AS widget_instance_uuid,       -- uuid from widget_instances
      wi.status                              AS instance_status,
      NEW.widget_id                          AS widget_id,
      w.workspace_id                         AS workspace_id,
      'submission.created'                   AS event_type,
      COALESCE(NEW.ts, now())                AS event_time,
      NEW.payload                            AS submission_payload,
      NEW.ip                                 AS submission_ip,
      NEW.ua                                 AS submission_ua,
      NEW.ts                                 AS submission_ts
  FROM public.widget_instances wi
  LEFT JOIN public.widgets w
         ON w.id = NEW.widget_id
  WHERE wi.public_id = NEW.widget_instance_id;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."widget_submissions_trace_ai"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agency_packages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agency_workspace_id" "uuid" NOT NULL,
    "product" "public"."billing_product" NOT NULL,
    "units_purchased" integer NOT NULL,
    "status" "public"."package_status" DEFAULT 'active'::"public"."package_status" NOT NULL,
    "notes" "text",
    "starts_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ends_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "agency_packages_units_purchased_check" CHECK (("units_purchased" > 0))
);


ALTER TABLE "public"."agency_packages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workspace_allocations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "units_allocated" integer NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "workspace_allocations_units_allocated_check" CHECK (("units_allocated" > 0))
);


ALTER TABLE "public"."workspace_allocations" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."agency_package_allocations" AS
 SELECT "ap"."id" AS "package_id",
    "ap"."agency_workspace_id",
    "ap"."product",
    "ap"."units_purchased",
    "ap"."status",
    COALESCE("sum"(
        CASE
            WHEN ("wa"."status" = 'active'::"text") THEN "wa"."units_allocated"
            ELSE 0
        END), (0)::bigint) AS "units_allocated",
    ("ap"."units_purchased" - COALESCE("sum"(
        CASE
            WHEN ("wa"."status" = 'active'::"text") THEN "wa"."units_allocated"
            ELSE 0
        END), (0)::bigint)) AS "units_remaining",
    "ap"."starts_at",
    "ap"."ends_at",
    "ap"."created_at"
   FROM ("public"."agency_packages" "ap"
     LEFT JOIN "public"."workspace_allocations" "wa" ON (("wa"."package_id" = "ap"."id")))
  WHERE ("ap"."status" = 'active'::"public"."package_status")
  GROUP BY "ap"."id", "ap"."agency_workspace_id", "ap"."product", "ap"."units_purchased", "ap"."status", "ap"."starts_at", "ap"."ends_at", "ap"."created_at"
  ORDER BY "ap"."created_at" DESC;


ALTER VIEW "public"."agency_package_allocations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."billing_account_workspaces" (
    "billing_account_id" "uuid" NOT NULL,
    "workspace_id" "uuid" NOT NULL
);


ALTER TABLE "public"."billing_account_workspaces" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."billing_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."billing_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "entity_type" "text",
    "entity_id" "uuid",
    "event_type" "text" NOT NULL,
    "actor_id" "uuid",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "event_id" "uuid",
    "cfg_version" "text",
    "embed_version" "text",
    "client_run_id" "uuid",
    "page_origin_hash" "text",
    "idempotency_hash" "text"
);


ALTER TABLE "public"."events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feature_flags" (
    "workspace_id" "uuid" NOT NULL,
    "feature_key" "text" NOT NULL,
    "enabled" boolean DEFAULT false NOT NULL,
    "variant" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."feature_flags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."widget_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "widget_id" "uuid" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "ts" timestamp with time zone DEFAULT "now"(),
    "ip" "text",
    "ua" "text",
    "widget_instance_id" "text",
    "payload_hash" "text",
    "ts_second" timestamp with time zone,
    CONSTRAINT "widget_submissions_payload_max32kb" CHECK (("pg_column_size"("payload") <= 32768))
);


ALTER TABLE "public"."widget_submissions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."form_submissions" AS
 SELECT "id",
    "widget_id",
    "widget_instance_id",
    "payload",
    "ip",
    "ua",
    "ts"
   FROM "public"."widget_submissions" "ws";


ALTER VIEW "public"."form_submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."materialized_view_refresh_log" (
    "view_name" "text" NOT NULL,
    "refreshed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."materialized_view_refresh_log" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."oslo_tokens" AS
 SELECT "id",
    "widget_instance_id",
    "token",
    "expires_at",
    "created_at",
    "created_by"
   FROM "public"."embed_tokens";


ALTER VIEW "public"."oslo_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."performance_baseline_audit" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "test_name" "text" NOT NULL,
    "run_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "duration_ms" numeric NOT NULL,
    "status" "text" NOT NULL
);


ALTER TABLE "public"."performance_baseline_audit" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plan_features" (
    "plan_id" "text" NOT NULL,
    "feature_key" "text" NOT NULL,
    "limit_value" integer,
    "enabled" boolean,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."plan_features" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plan_limits" (
    "plan_id" "text" NOT NULL,
    "limit_type" "text" NOT NULL,
    "limit_value" integer NOT NULL,
    "enforcement" "text" DEFAULT 'soft'::"text" NOT NULL,
    "grace_amount" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."plan_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plugin_artifacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "widget_id" "uuid" NOT NULL,
    "version" "text" NOT NULL,
    "content" "bytea" NOT NULL,
    "bytes" integer GENERATED ALWAYS AS ("octet_length"("content")) STORED,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "plugin_artifacts_max_28kb" CHECK (("octet_length"("content") <= 28672))
);


ALTER TABLE "public"."plugin_artifacts" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."plugin_artifacts_latest" AS
 SELECT DISTINCT ON ("widget_id") "widget_id",
    "id" AS "artifact_id",
    "version",
    "bytes",
    "created_at"
   FROM "public"."plugin_artifacts" "pa"
  ORDER BY "widget_id", "created_at" DESC;


ALTER VIEW "public"."plugin_artifacts_latest" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "user_id" "uuid" NOT NULL,
    "name" "text",
    "company" "text",
    "subscription_status" "text" DEFAULT 'trial'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "created_source" "public"."user_created_source" DEFAULT 'signup_form'::"public"."user_created_source",
    "created_ip" "inet",
    "created_user_agent" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."submission_rate_window" (
    "token_id" "uuid" NOT NULL,
    "bucket_start" timestamp with time zone NOT NULL,
    "count" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."submission_rate_window" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."widget_instances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "widget_id" "uuid" NOT NULL,
    "public_id" "text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "draft_token" "uuid",
    "claimed_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "template_id" "text",
    "schema_version" "text",
    CONSTRAINT "widget_instances_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'inactive'::"text"])))
);


ALTER TABLE "public"."widget_instances" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."widgets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "public_key" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "workspace_id" "uuid" NOT NULL,
    "template_id" "text",
    "schema_version" "text"
);


ALTER TABLE "public"."widgets" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."submission_trace" AS
 SELECT "sub"."id" AS "submission_id",
    "sub"."widget_instance_id" AS "widget_instance_public_id",
    "wi"."id" AS "widget_instance_uuid",
    "wi"."status" AS "instance_status",
    "w"."id" AS "widget_id",
    "w"."workspace_id",
    "e"."event_type",
    "e"."created_at" AS "event_time",
    "sub"."payload" AS "submission_payload",
    "sub"."ip" AS "submission_ip",
    "sub"."ua" AS "submission_ua",
    "sub"."ts" AS "submission_ts"
   FROM ((("public"."widget_submissions" "sub"
     LEFT JOIN "public"."events" "e" ON (("e"."entity_id" = "sub"."id")))
     LEFT JOIN "public"."widget_instances" "wi" ON (("wi"."public_id" = "sub"."widget_instance_id")))
     LEFT JOIN "public"."widgets" "w" ON (("w"."id" = "wi"."widget_id")));


ALTER VIEW "public"."submission_trace" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."test_migration" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."test_migration" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."usage_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "event_type" "text" DEFAULT 'feature_usage'::"text" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "feature_key" "text",
    "widget_type" "text",
    "widget_instance_id" "text",
    "event_id" "uuid",
    "cfg_version" "text",
    "embed_version" "text",
    "client_run_id" "uuid",
    "page_origin_hash" "text",
    "idempotency_hash" "text"
);


ALTER TABLE "public"."usage_events" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."usage_month_to_date_v1" AS
 SELECT "workspace_id",
    "feature_key",
    "date_trunc"('month'::"text", "now"()) AS "month",
    "sum"(COALESCE("quantity", 1)) AS "mtd_total"
   FROM "public"."usage_events" "ue"
  WHERE (("created_at" >= "date_trunc"('month'::"text", "now"())) AND (("event_type" = 'feature_usage'::"text") OR ("event_type" IS NULL)))
  GROUP BY "workspace_id", "feature_key";


ALTER VIEW "public"."usage_month_to_date_v1" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "public"."usage_monthly_rollup" AS
 SELECT "workspace_id",
    "feature_key",
    "date_trunc"('month'::"text", "created_at") AS "month",
    "sum"(COALESCE("quantity", 1)) AS "month_total"
   FROM "public"."usage_events" "ue"
  WHERE (("event_type" = 'feature_usage'::"text") OR ("event_type" IS NULL))
  GROUP BY "workspace_id", "feature_key", ("date_trunc"('month'::"text", "created_at"))
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."usage_monthly_rollup" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."usage_monthly_rollup_health_v1" AS
 SELECT "view_name",
    "refreshed_at" AS "last_refresh",
    "pg_size_pretty"("pg_total_relation_size"('"public"."usage_monthly_rollup"'::"regclass")) AS "total_size"
   FROM "public"."materialized_view_refresh_log" "l"
  WHERE ("view_name" = 'usage_monthly_rollup'::"text")
  ORDER BY "refreshed_at" DESC
 LIMIT 1;


ALTER VIEW "public"."usage_monthly_rollup_health_v1" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."usage_monthly_summary" AS
 SELECT "workspace_id",
    "feature_key",
    "date_trunc"('month'::"text", "created_at") AS "month",
    "sum"("quantity") AS "month_total"
   FROM "public"."usage_events"
  GROUP BY "workspace_id", "feature_key", ("date_trunc"('month'::"text", "created_at"));


ALTER VIEW "public"."usage_monthly_summary" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."usage_mtd_by_billing_account" AS
 SELECT "baw"."billing_account_id",
    "sum"("u"."quantity") AS "units_mtd"
   FROM ("public"."billing_account_workspaces" "baw"
     JOIN "public"."usage_events" "u" ON ((("u"."workspace_id" = "baw"."workspace_id") AND ("date_trunc"('month'::"text", "u"."created_at") = "date_trunc"('month'::"text", "now"())))))
  GROUP BY "baw"."billing_account_id";


ALTER VIEW "public"."usage_mtd_by_billing_account" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_creation_audit" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "created_source" "public"."user_created_source" NOT NULL,
    "created_ip" "inet",
    "created_user_agent" "text",
    "raw_meta" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_creation_audit" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."widget_claim_audit" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "widget_instance_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "workspace_id" "uuid",
    "draft_token" "uuid",
    "success" boolean NOT NULL,
    "reason" "text",
    "claimed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_claim_success_has_token" CHECK ((("success" = false) OR ("draft_token" IS NOT NULL) OR ("reason" = 'backfill_missing_claim'::"text")))
);


ALTER TABLE "public"."widget_claim_audit" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_claim_failures_24h" AS
 SELECT "a"."widget_instance_id",
    "wi"."public_id",
    "wi"."status" AS "instance_status",
    "w"."workspace_id",
    "a"."reason",
    "a"."claimed_at"
   FROM (("public"."widget_claim_audit" "a"
     JOIN "public"."widget_instances" "wi" ON (("wi"."id" = "a"."widget_instance_id")))
     JOIN "public"."widgets" "w" ON (("w"."id" = "wi"."widget_id")))
  WHERE (("a"."success" = false) AND ("a"."claimed_at" >= ("now"() - '24:00:00'::interval)))
  ORDER BY "a"."claimed_at" DESC;


ALTER VIEW "public"."v_claim_failures_24h" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_claim_last_attempt" AS
 SELECT "aa"."widget_instance_id",
    "wi"."public_id",
    "wi"."status" AS "instance_status",
    "w"."workspace_id",
        CASE
            WHEN "aa"."success" THEN 'success'::"text"
            ELSE 'failure'::"text"
        END AS "last_status",
    "aa"."reason" AS "last_reason",
    "aa"."claimed_at" AS "last_claimed_at"
   FROM ((( SELECT DISTINCT ON ("widget_claim_audit"."widget_instance_id") "widget_claim_audit"."widget_instance_id",
            "widget_claim_audit"."success",
            "widget_claim_audit"."reason",
            "widget_claim_audit"."claimed_at"
           FROM "public"."widget_claim_audit"
          ORDER BY "widget_claim_audit"."widget_instance_id", "widget_claim_audit"."claimed_at" DESC) "aa"
     JOIN "public"."widget_instances" "wi" ON (("wi"."id" = "aa"."widget_instance_id")))
     JOIN "public"."widgets" "w" ON (("w"."id" = "wi"."widget_id")))
  ORDER BY "aa"."claimed_at" DESC;


ALTER VIEW "public"."v_claim_last_attempt" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."widget_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "widget_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "meta" "jsonb" DEFAULT '{}'::"jsonb",
    "ts" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."widget_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."widget_fetch_errors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "public_id" "text" NOT NULL,
    "error_code" "text" NOT NULL,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."widget_fetch_errors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."widget_schemas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "widget_type" "text" NOT NULL,
    "schema_version" "text" NOT NULL,
    "schema" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."widget_schemas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."widget_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "widget_type" "text" NOT NULL,
    "template_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "layout" "text",
    "skin" "text",
    "density" "text",
    "accents" "text"[],
    "premium" boolean DEFAULT false,
    "schema_version" "text" NOT NULL,
    "defaults" "jsonb" DEFAULT '{}'::"jsonb",
    "descriptor" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "widget_templates_density_check" CHECK (("density" = ANY (ARRAY['COZY'::"text", 'COMPACT'::"text"]))),
    CONSTRAINT "widget_templates_layout_check" CHECK (("layout" = ANY (ARRAY['LIST'::"text", 'GRID'::"text", 'CAROUSEL'::"text", 'CARD'::"text", 'ACCORDION'::"text", 'MARQUEE'::"text", 'STACKED'::"text", 'INLINE'::"text"]))),
    CONSTRAINT "widget_templates_skin_check" CHECK (("skin" = ANY (ARRAY['MINIMAL'::"text", 'SOFT'::"text", 'SHARP'::"text", 'GLASS'::"text"])))
);


ALTER TABLE "public"."widget_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workspace_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'owner'::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "invited_by" "uuid",
    "invited_at" timestamp with time zone DEFAULT "now"(),
    "accepted_at" timestamp with time zone,
    CONSTRAINT "workspace_members_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'super_editor'::"text", 'editor'::"text", 'collaborator'::"text", 'viewer'::"text"])))
);


ALTER TABLE "public"."workspace_members" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."workspace_recent_events" AS
 SELECT "workspace_id",
    "created_at",
    "event_type",
    "entity_type",
    "entity_id",
    "actor_id",
    "payload",
    "metadata"
   FROM "public"."events" "e"
  WHERE ("created_at" >= ("now"() - '30 days'::interval));


ALTER VIEW "public"."workspace_recent_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workspaces" (
    "id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "plan" "text" DEFAULT 'free'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "kind" "text" DEFAULT 'business'::"text" NOT NULL,
    "parent_workspace_id" "uuid",
    CONSTRAINT "agency_must_have_paid_plan" CHECK ((NOT (("kind" = 'agency'::"text") AND ("plan" = 'free'::"text")))),
    CONSTRAINT "workspaces_kind_check" CHECK (("kind" = ANY (ARRAY['agency'::"text", 'business'::"text"])))
);


ALTER TABLE "public"."workspaces" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."workspaces_with_payer" AS
 SELECT "w"."id" AS "workspace_id",
    "w"."name" AS "workspace_name",
    "w"."kind" AS "workspace_kind",
    "w"."parent_workspace_id",
    "w"."plan",
    "w"."created_at",
    "p"."id" AS "parent_id",
    "p"."name" AS "parent_name",
    "p"."kind" AS "parent_kind",
        CASE
            WHEN ("w"."kind" = 'agency'::"text") THEN "w"."id"
            WHEN ("p"."kind" = 'agency'::"text") THEN "p"."id"
            ELSE "w"."id"
        END AS "payer_workspace_id",
        CASE
            WHEN ("w"."kind" = 'agency'::"text") THEN 'agency'::"text"
            WHEN ("p"."kind" = 'agency'::"text") THEN 'agency'::"text"
            ELSE "w"."kind"
        END AS "payer_kind"
   FROM ("public"."workspaces" "w"
     LEFT JOIN "public"."workspaces" "p" ON (("p"."id" = "w"."parent_workspace_id")));


ALTER VIEW "public"."workspaces_with_payer" OWNER TO "postgres";


ALTER TABLE ONLY "public"."agency_packages"
    ADD CONSTRAINT "agency_packages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."billing_account_workspaces"
    ADD CONSTRAINT "billing_account_workspaces_pkey" PRIMARY KEY ("billing_account_id", "workspace_id");



ALTER TABLE ONLY "public"."billing_accounts"
    ADD CONSTRAINT "billing_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feature_flags"
    ADD CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("workspace_id", "feature_key");



ALTER TABLE ONLY "public"."embed_tokens"
    ADD CONSTRAINT "oslo_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."embed_tokens"
    ADD CONSTRAINT "oslo_tokens_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."performance_baseline_audit"
    ADD CONSTRAINT "performance_baseline_audit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plan_features"
    ADD CONSTRAINT "plan_features_pk" PRIMARY KEY ("plan_id", "feature_key");



ALTER TABLE ONLY "public"."plan_limits"
    ADD CONSTRAINT "plan_limits_pkey" PRIMARY KEY ("plan_id", "limit_type");



ALTER TABLE ONLY "public"."plugin_artifacts"
    ADD CONSTRAINT "plugin_artifacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."submission_rate_window"
    ADD CONSTRAINT "submission_rate_window_pkey" PRIMARY KEY ("token_id", "bucket_start");



ALTER TABLE ONLY "public"."test_migration"
    ADD CONSTRAINT "test_migration_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."usage_events"
    ADD CONSTRAINT "usage_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_creation_audit"
    ADD CONSTRAINT "user_creation_audit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."widget_claim_audit"
    ADD CONSTRAINT "widget_claim_audit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."widget_events"
    ADD CONSTRAINT "widget_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."widget_fetch_errors"
    ADD CONSTRAINT "widget_fetch_errors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."widget_instances"
    ADD CONSTRAINT "widget_instances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."widget_instances"
    ADD CONSTRAINT "widget_instances_public_id_key" UNIQUE ("public_id");



ALTER TABLE ONLY "public"."widget_schemas"
    ADD CONSTRAINT "widget_schemas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."widget_schemas"
    ADD CONSTRAINT "widget_schemas_widget_type_schema_version_key" UNIQUE ("widget_type", "schema_version");



ALTER TABLE ONLY "public"."widget_submissions"
    ADD CONSTRAINT "widget_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."widget_templates"
    ADD CONSTRAINT "widget_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."widget_templates"
    ADD CONSTRAINT "widget_templates_template_id_key" UNIQUE ("template_id");



ALTER TABLE ONLY "public"."widget_templates"
    ADD CONSTRAINT "widget_templates_widget_type_template_id_key" UNIQUE ("widget_type", "template_id");



ALTER TABLE ONLY "public"."widgets"
    ADD CONSTRAINT "widgets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."widgets"
    ADD CONSTRAINT "widgets_public_key_key" UNIQUE ("public_key");



ALTER TABLE ONLY "public"."workspace_allocations"
    ADD CONSTRAINT "workspace_allocations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_workspace_id_user_id_key" UNIQUE ("workspace_id", "user_id");



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id");



CREATE INDEX "baw_workspace_idx" ON "public"."billing_account_workspaces" USING "btree" ("workspace_id");



CREATE UNIQUE INDEX "events_event_id_unique_idx" ON "public"."events" USING "btree" ("event_id") WHERE ("event_id" IS NOT NULL);



CREATE UNIQUE INDEX "events_idempotency_hash_key" ON "public"."events" USING "btree" ("idempotency_hash") WHERE ("idempotency_hash" IS NOT NULL);



CREATE INDEX "feature_flags_workspace_enabled_idx" ON "public"."feature_flags" USING "btree" ("workspace_id", "enabled");



CREATE UNIQUE INDEX "feature_flags_workspace_feature_uniq" ON "public"."feature_flags" USING "btree" ("workspace_id", "feature_key");



CREATE INDEX "idx_agency_packages_agency" ON "public"."agency_packages" USING "btree" ("agency_workspace_id");



CREATE INDEX "idx_agency_packages_product" ON "public"."agency_packages" USING "btree" ("product");



CREATE INDEX "idx_claim_audit_instance_time" ON "public"."widget_claim_audit" USING "btree" ("widget_instance_id", "claimed_at" DESC);



CREATE INDEX "idx_claim_audit_success_time" ON "public"."widget_claim_audit" USING "btree" ("success", "claimed_at" DESC);



CREATE INDEX "idx_events_entity_event_created" ON "public"."events" USING "btree" ("entity_type", "event_type", "created_at" DESC);



CREATE INDEX "idx_events_type_created_at" ON "public"."events" USING "btree" ("event_type", "created_at" DESC);



CREATE UNIQUE INDEX "idx_events_unique_submission_created" ON "public"."events" USING "btree" ("entity_id") WHERE (("entity_type" = 'submission'::"text") AND ("event_type" = 'submission.created'::"text"));



CREATE INDEX "idx_events_widget" ON "public"."widget_events" USING "btree" ("widget_id");



CREATE INDEX "idx_events_workspace_created_at" ON "public"."events" USING "btree" ("workspace_id", "created_at" DESC);



CREATE INDEX "idx_events_ws_created_at" ON "public"."events" USING "btree" ("workspace_id", "created_at" DESC);



CREATE INDEX "idx_feature_flags_ws_key_updated" ON "public"."feature_flags" USING "btree" ("workspace_id", "feature_key", "updated_at" DESC);



CREATE INDEX "idx_oslo_tokens_expires_at" ON "public"."embed_tokens" USING "btree" ("expires_at");



CREATE INDEX "idx_oslo_tokens_token" ON "public"."embed_tokens" USING "btree" ("token");



CREATE INDEX "idx_oslo_tokens_widget_instance" ON "public"."embed_tokens" USING "btree" ("widget_instance_id");



CREATE INDEX "idx_plugin_artifacts_widget_created" ON "public"."plugin_artifacts" USING "btree" ("widget_id", "created_at" DESC);



CREATE INDEX "idx_submissions_widget" ON "public"."widget_submissions" USING "btree" ("widget_id");



CREATE UNIQUE INDEX "idx_unique_claim_success" ON "public"."widget_claim_audit" USING "btree" ("widget_instance_id") WHERE ("success" = true);



CREATE INDEX "idx_usage_events_created" ON "public"."usage_events" USING "btree" ("created_at");



CREATE INDEX "idx_usage_events_workspace_event" ON "public"."usage_events" USING "btree" ("workspace_id", "event_type", "created_at" DESC);



CREATE INDEX "idx_usage_events_workspace_type" ON "public"."usage_events" USING "btree" ("workspace_id", "event_type", "created_at" DESC);



CREATE INDEX "idx_usage_events_ws_event_created" ON "public"."usage_events" USING "btree" ("workspace_id", "event_type", "created_at");



CREATE INDEX "idx_usage_events_ws_feat_created" ON "public"."usage_events" USING "btree" ("workspace_id", "feature_key", "created_at");



CREATE INDEX "idx_usage_events_ws_feature_created" ON "public"."usage_events" USING "btree" ("workspace_id", "feature_key", "created_at");



CREATE INDEX "idx_widget_claim_audit_draft_token" ON "public"."widget_claim_audit" USING "btree" ("draft_token") WHERE ("draft_token" IS NOT NULL);



CREATE INDEX "idx_widget_claim_audit_instance_claimed_at" ON "public"."widget_claim_audit" USING "btree" ("widget_instance_id", "claimed_at" DESC);



CREATE INDEX "idx_widget_claim_audit_user_claimed_at" ON "public"."widget_claim_audit" USING "btree" ("user_id", "claimed_at" DESC) WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_widget_fetch_errors_public_id" ON "public"."widget_fetch_errors" USING "btree" ("public_id");



CREATE INDEX "idx_widget_instances_claimed_at" ON "public"."widget_instances" USING "btree" ("claimed_at") WHERE ("claimed_at" IS NOT NULL);



CREATE INDEX "idx_widget_instances_expires_at" ON "public"."widget_instances" USING "btree" ("expires_at") WHERE ("expires_at" IS NOT NULL);



CREATE INDEX "idx_widget_instances_public_published" ON "public"."widget_instances" USING "btree" ("public_id") INCLUDE ("id", "widget_id") WHERE ("status" = 'published'::"text");



CREATE INDEX "idx_widget_instances_status" ON "public"."widget_instances" USING "btree" ("status");



CREATE INDEX "idx_widget_instances_widget_id" ON "public"."widget_instances" USING "btree" ("widget_id");



CREATE INDEX "idx_widget_submissions_instance" ON "public"."widget_submissions" USING "btree" ("widget_instance_id");



CREATE INDEX "idx_widget_submissions_instance_ts" ON "public"."widget_submissions" USING "btree" ("widget_instance_id", "ts" DESC);



CREATE INDEX "idx_widgets_user" ON "public"."widgets" USING "btree" ("user_id");



CREATE INDEX "idx_widgets_user_id" ON "public"."widgets" USING "btree" ("user_id");



CREATE INDEX "idx_workspace_members_lookup" ON "public"."workspace_members" USING "btree" ("workspace_id", "user_id", "status", "role");



CREATE INDEX "idx_workspace_members_user" ON "public"."workspace_members" USING "btree" ("user_id");



CREATE INDEX "idx_workspace_members_user_id" ON "public"."workspace_members" USING "btree" ("user_id");



CREATE INDEX "idx_workspace_members_workspace_id" ON "public"."workspace_members" USING "btree" ("workspace_id");



CREATE INDEX "idx_workspace_members_wsrole" ON "public"."workspace_members" USING "btree" ("workspace_id", "role");



CREATE INDEX "ix_claim_audit_user_inst_time" ON "public"."widget_claim_audit" USING "btree" ("user_id", "widget_instance_id", "claimed_at") WHERE ("success" = false);



CREATE INDEX "plan_features_plan_idx" ON "public"."plan_features" USING "btree" ("plan_id");



CREATE UNIQUE INDEX "uniq_widget_claim_success_once" ON "public"."widget_claim_audit" USING "btree" ("widget_instance_id") WHERE ("success" = true);



CREATE UNIQUE INDEX "uq_oslo_tokens_token" ON "public"."embed_tokens" USING "btree" ("token");



CREATE UNIQUE INDEX "uq_plugin_artifacts_widget_version" ON "public"."plugin_artifacts" USING "btree" ("widget_id", "version");



CREATE UNIQUE INDEX "uq_usage_monthly_rollup" ON "public"."usage_monthly_rollup" USING "btree" ("workspace_id", "feature_key", "month");



CREATE UNIQUE INDEX "uq_widget_claim_success_per_instance" ON "public"."widget_claim_audit" USING "btree" ("widget_instance_id") WHERE ("success" = true);



CREATE UNIQUE INDEX "uq_widget_instances_draft_token" ON "public"."widget_instances" USING "btree" ("draft_token") WHERE ("draft_token" IS NOT NULL);



CREATE UNIQUE INDEX "uq_workspace_allocations_package_workspace" ON "public"."workspace_allocations" USING "btree" ("package_id", "workspace_id");



CREATE INDEX "usage_events_event_id_idx" ON "public"."usage_events" USING "btree" ("event_id");



CREATE UNIQUE INDEX "usage_events_idempotency_hash_key" ON "public"."usage_events" USING "btree" ("idempotency_hash") WHERE ("idempotency_hash" IS NOT NULL);



CREATE UNIQUE INDEX "ux_widget_claim_one_success" ON "public"."widget_claim_audit" USING "btree" ("widget_instance_id") WHERE ("success" = true);



CREATE INDEX "widget_instances_widget_id_idx" ON "public"."widget_instances" USING "btree" ("widget_id");



CREATE INDEX "widget_submissions_dedupe_idx" ON "public"."widget_submissions" USING "btree" ("widget_id", "ts_second", "payload_hash");



CREATE RULE "form_submissions_insert_rule" AS
    ON INSERT TO "public"."form_submissions" DO INSTEAD  INSERT INTO "public"."widget_submissions" ("widget_id", "payload", "ip", "ua")  SELECT "wi"."widget_id",
            "new"."payload",
            "new"."ip",
            "new"."ua"
           FROM "public"."widget_instances" "wi"
          WHERE ((("wi"."public_id" = "new"."widget_instance_id") OR (("wi"."id")::"text" = "new"."widget_instance_id")) AND ("wi"."status" = 'published'::"text"))
  RETURNING "widget_submissions"."id",
    "widget_submissions"."widget_id",
    ( SELECT "widget_instances"."public_id"
           FROM "public"."widget_instances"
          WHERE (("widget_instances"."widget_id" = "widget_submissions"."widget_id") AND ("widget_instances"."status" = 'published'::"text"))
         LIMIT 1) AS "widget_instance_id",
    "widget_submissions"."payload",
    "widget_submissions"."ip",
    "widget_submissions"."ua",
    "widget_submissions"."ts";



CREATE OR REPLACE TRIGGER "trg_form_submissions_insert" INSTEAD OF INSERT ON "public"."form_submissions" FOR EACH ROW EXECUTE FUNCTION "public"."form_submissions_insert"();



CREATE OR REPLACE TRIGGER "trg_widget_instances_updated_at" BEFORE UPDATE ON "public"."widget_instances" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_workspace_members_set_updated_at" BEFORE UPDATE ON "public"."workspace_members" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "widget_claim_audit_rate_limit" BEFORE INSERT ON "public"."widget_claim_audit" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_claim_rate_limit"();



CREATE OR REPLACE TRIGGER "widget_instances_claimed_at_publish" BEFORE INSERT OR UPDATE OF "status" ON "public"."widget_instances" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_claimed_at_on_publish"();



CREATE OR REPLACE TRIGGER "widget_submissions_fill_derived_trg" BEFORE INSERT OR UPDATE ON "public"."widget_submissions" FOR EACH ROW EXECUTE FUNCTION "public"."widget_submissions_fill_derived_v1"();



CREATE OR REPLACE TRIGGER "widget_submissions_trace_ai" AFTER INSERT ON "public"."widget_submissions" FOR EACH ROW EXECUTE FUNCTION "public"."widget_submissions_trace_ai"();



ALTER TABLE ONLY "public"."agency_packages"
    ADD CONSTRAINT "agency_packages_agency_workspace_id_fkey" FOREIGN KEY ("agency_workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."billing_account_workspaces"
    ADD CONSTRAINT "billing_account_workspaces_billing_account_id_fkey" FOREIGN KEY ("billing_account_id") REFERENCES "public"."billing_accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."billing_account_workspaces"
    ADD CONSTRAINT "billing_account_workspaces_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."billing_accounts"
    ADD CONSTRAINT "billing_accounts_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."embed_tokens"
    ADD CONSTRAINT "embed_tokens_instance_fk" FOREIGN KEY ("widget_instance_id") REFERENCES "public"."widget_instances"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."embed_tokens"
    ADD CONSTRAINT "oslo_tokens_widget_instance_id_fkey" FOREIGN KEY ("widget_instance_id") REFERENCES "public"."widget_instances"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plugin_artifacts"
    ADD CONSTRAINT "plugin_artifacts_widget_id_fkey" FOREIGN KEY ("widget_id") REFERENCES "public"."widgets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_creation_audit"
    ADD CONSTRAINT "user_creation_audit_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_creation_audit"
    ADD CONSTRAINT "user_creation_audit_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."widget_claim_audit"
    ADD CONSTRAINT "widget_claim_audit_widget_instance_id_fkey" FOREIGN KEY ("widget_instance_id") REFERENCES "public"."widget_instances"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."widget_events"
    ADD CONSTRAINT "widget_events_widget_id_fkey" FOREIGN KEY ("widget_id") REFERENCES "public"."widgets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."widget_instances"
    ADD CONSTRAINT "widget_instances_widget_id_fkey" FOREIGN KEY ("widget_id") REFERENCES "public"."widgets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."widget_submissions"
    ADD CONSTRAINT "widget_submissions_widget_id_fkey" FOREIGN KEY ("widget_id") REFERENCES "public"."widgets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."widgets"
    ADD CONSTRAINT "widgets_workspace_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."workspace_allocations"
    ADD CONSTRAINT "workspace_allocations_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."agency_packages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspace_allocations"
    ADD CONSTRAINT "workspace_allocations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_parent_workspace_id_fkey" FOREIGN KEY ("parent_workspace_id") REFERENCES "public"."workspaces"("id");



CREATE POLICY "Owner can delete own widgets" ON "public"."widgets" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Owner can insert own widgets" ON "public"."widgets" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "baw_owner_or_member_read" ON "public"."billing_account_workspaces" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."billing_accounts" "ba"
  WHERE (("ba"."id" = "billing_account_workspaces"."billing_account_id") AND ("ba"."owner_user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."workspace_members" "m"
  WHERE (("m"."workspace_id" = "billing_account_workspaces"."workspace_id") AND ("m"."user_id" = "auth"."uid"()))))));



CREATE POLICY "baw_owner_write" ON "public"."billing_account_workspaces" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."billing_accounts" "ba"
  WHERE (("ba"."id" = "billing_account_workspaces"."billing_account_id") AND ("ba"."owner_user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."billing_accounts" "ba"
  WHERE (("ba"."id" = "billing_account_workspaces"."billing_account_id") AND ("ba"."owner_user_id" = "auth"."uid"())))));



ALTER TABLE "public"."billing_account_workspaces" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."billing_accounts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "billing_accounts_owner_rw" ON "public"."billing_accounts" TO "authenticated" USING (("owner_user_id" = "auth"."uid"())) WITH CHECK (("owner_user_id" = "auth"."uid"()));



ALTER TABLE "public"."embed_tokens" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "embed_tokens_deny_all" ON "public"."embed_tokens" USING (false) WITH CHECK (false);



CREATE POLICY "embed_tokens_member_read" ON "public"."embed_tokens" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."widget_instances" "wi"
     JOIN "public"."widgets" "w" ON (("w"."id" = "wi"."widget_id")))
     JOIN "public"."workspace_members" "m" ON (("m"."workspace_id" = "w"."workspace_id")))
  WHERE (("wi"."id" = "embed_tokens"."widget_instance_id") AND ("m"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "events_read_members" ON "public"."events" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."workspace_members" "m"
  WHERE (("m"."workspace_id" = "events"."workspace_id") AND ("m"."user_id" = "auth"."uid"())))));



CREATE POLICY "member can update self" ON "public"."workspace_members" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "members can select workspace memberships" ON "public"."workspace_members" FOR SELECT TO "authenticated" USING (("workspace_id" IN ( SELECT "m"."workspace_id"
   FROM "public"."workspace_members" "m"
  WHERE ("m"."user_id" = "auth"."uid"()))));



CREATE POLICY "members_can_select_their_workspace_members" ON "public"."workspace_members" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."workspace_members" "me"
  WHERE (("me"."workspace_id" = "workspace_members"."workspace_id") AND ("me"."user_id" = "auth"."uid"()) AND ("me"."status" = 'active'::"text")))));



CREATE POLICY "members_read_own" ON "public"."workspace_members" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "members_select_own_workspace" ON "public"."workspaces" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."workspace_members" "m"
  WHERE (("m"."workspace_id" = "workspaces"."id") AND ("m"."user_id" = "auth"."uid"()) AND ("m"."status" = 'active'::"text")))));



CREATE POLICY "owners or admins can delete members" ON "public"."workspace_members" FOR DELETE TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."workspace_members" "me"
  WHERE (("me"."workspace_id" = "workspace_members"."workspace_id") AND ("me"."user_id" = "auth"."uid"()) AND ("me"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))));



CREATE POLICY "owners or admins can insert members" ON "public"."workspace_members" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."workspace_members" "me"
  WHERE (("me"."workspace_id" = "workspace_members"."workspace_id") AND ("me"."user_id" = "auth"."uid"()) AND ("me"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "owners or admins can update members" ON "public"."workspace_members" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."workspace_members" "me"
  WHERE (("me"."workspace_id" = "workspace_members"."workspace_id") AND ("me"."user_id" = "auth"."uid"()) AND ("me"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."workspace_members" "me"
  WHERE (("me"."workspace_id" = "workspace_members"."workspace_id") AND ("me"."user_id" = "auth"."uid"()) AND ("me"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "owners_admins_delete_workspace" ON "public"."workspaces" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."workspace_members" "m"
  WHERE (("m"."workspace_id" = "workspaces"."id") AND ("m"."user_id" = "auth"."uid"()) AND ("m"."status" = 'active'::"text") AND ("m"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "owners_admins_update_workspace" ON "public"."workspaces" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."workspace_members" "m"
  WHERE (("m"."workspace_id" = "workspaces"."id") AND ("m"."user_id" = "auth"."uid"()) AND ("m"."status" = 'active'::"text") AND ("m"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."workspace_members" "m"
  WHERE (("m"."workspace_id" = "workspaces"."id") AND ("m"."user_id" = "auth"."uid"()) AND ("m"."status" = 'active'::"text") AND ("m"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "owners_can_delete_members" ON "public"."workspace_members" FOR DELETE TO "authenticated" USING ("public"."is_workspace_owner"("workspace_id"));



CREATE POLICY "owners_can_insert_members" ON "public"."workspace_members" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_workspace_owner"("workspace_id"));



CREATE POLICY "owners_can_update_members" ON "public"."workspace_members" FOR UPDATE TO "authenticated" USING ("public"."is_workspace_owner"("workspace_id")) WITH CHECK ("public"."is_workspace_owner"("workspace_id"));



CREATE POLICY "owners_or_admins_can_delete_members" ON "public"."workspace_members" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."workspace_members" "me"
  WHERE (("me"."workspace_id" = "workspace_members"."workspace_id") AND ("me"."user_id" = "auth"."uid"()) AND ("me"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])) AND ("me"."status" = 'active'::"text")))));



CREATE POLICY "owners_or_admins_can_insert_members" ON "public"."workspace_members" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."workspace_members" "me"
  WHERE (("me"."workspace_id" = "workspace_members"."workspace_id") AND ("me"."user_id" = "auth"."uid"()) AND ("me"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])) AND ("me"."status" = 'active'::"text")))));



CREATE POLICY "owners_or_admins_can_update_members" ON "public"."workspace_members" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."workspace_members" "me"
  WHERE (("me"."workspace_id" = "workspace_members"."workspace_id") AND ("me"."user_id" = "auth"."uid"()) AND ("me"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])) AND ("me"."status" = 'active'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."workspace_members" "me"
  WHERE (("me"."workspace_id" = "workspace_members"."workspace_id") AND ("me"."user_id" = "auth"."uid"()) AND ("me"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"])) AND ("me"."status" = 'active'::"text")))));



ALTER TABLE "public"."plan_features" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "plan_features_read_all" ON "public"."plan_features" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."widget_instances" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "widget_instances_delete_own_auth" ON "public"."widget_instances" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."widgets" "w"
  WHERE (("w"."id" = "widget_instances"."widget_id") AND ("w"."user_id" = "auth"."uid"())))));



CREATE POLICY "widget_instances_insert_own_auth" ON "public"."widget_instances" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."widgets" "w"
  WHERE (("w"."id" = "widget_instances"."widget_id") AND ("w"."user_id" = "auth"."uid"())))));



CREATE POLICY "widget_instances_select_own_auth" ON "public"."widget_instances" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."widgets" "w"
  WHERE (("w"."id" = "widget_instances"."widget_id") AND ("w"."user_id" = "auth"."uid"())))));



CREATE POLICY "widget_instances_update_own_auth" ON "public"."widget_instances" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."widgets" "w"
  WHERE (("w"."id" = "widget_instances"."widget_id") AND ("w"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."widget_submissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."widgets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "workspace_admins_manage_members" ON "public"."workspace_members" USING ((EXISTS ( SELECT 1
   FROM "public"."workspace_members" "m2"
  WHERE (("m2"."workspace_id" = "workspace_members"."workspace_id") AND ("m2"."user_id" = "auth"."uid"()) AND ("m2"."role" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



ALTER TABLE "public"."workspace_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workspaces" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."backfill_submission_created_events_v1"("p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."backfill_submission_created_events_v1"("p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."backfill_submission_created_events_v1"("p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."check_feature_limit_v1"("p_workspace_id" "uuid", "p_feature_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_feature_limit_v1"("p_workspace_id" "uuid", "p_feature_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_feature_limit_v1"("p_workspace_id" "uuid", "p_feature_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."claim_widget_draft_v1"("p_widget_instance_id" "uuid", "p_draft_token" "uuid", "p_workspace_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."claim_widget_draft_v1"("p_widget_instance_id" "uuid", "p_draft_token" "uuid", "p_workspace_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_widget_draft_v1"("p_widget_instance_id" "uuid", "p_draft_token" "uuid", "p_workspace_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."claim_widget_instance_v1"("p_widget_instance_id" "uuid", "p_draft_token" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."claim_widget_instance_v1"("p_widget_instance_id" "uuid", "p_draft_token" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_widget_instance_v1"("p_widget_instance_id" "uuid", "p_draft_token" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."consume_feature_units_v1"("p_workspace_id" "uuid", "p_feature_key" "text", "p_quantity" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."consume_feature_units_v1"("p_workspace_id" "uuid", "p_feature_key" "text", "p_quantity" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."consume_feature_units_v1"("p_workspace_id" "uuid", "p_feature_key" "text", "p_quantity" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_widget_with_instance"("p_name" "text", "p_type" "text", "p_config" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_widget_with_instance"("p_name" "text", "p_type" "text", "p_public_key" "text", "p_public_id" "text", "p_widget_config" "jsonb", "p_instance_config" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_workspace_for_user_v1"("p_plan" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_workspace_for_user_v1"("p_plan" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_workspace_for_user_v1"("p_plan" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_workspace_v1"("p_plan" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_workspace_v1"("p_plan" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_workspace_v1"("p_plan" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."db_logic_audit_v1"() TO "anon";
GRANT ALL ON FUNCTION "public"."db_logic_audit_v1"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."db_logic_audit_v1"() TO "service_role";



GRANT ALL ON FUNCTION "public"."db_schema_audit_v1"() TO "anon";
GRANT ALL ON FUNCTION "public"."db_schema_audit_v1"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."db_schema_audit_v1"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_claim_rate_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_claim_rate_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_claim_rate_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_claimed_at_on_publish"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_claimed_at_on_publish"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_claimed_at_on_publish"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_limit_v1"("p_workspace_id" "uuid", "p_event_type" "text", "p_quantity" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_limit_v1"("p_workspace_id" "uuid", "p_event_type" "text", "p_quantity" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_limit_v1"("p_workspace_id" "uuid", "p_event_type" "text", "p_quantity" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_submission_rate_limit_by_token_v1"("p_token" "text", "p_now" timestamp with time zone, "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_submission_rate_limit_by_token_v1"("p_token" "text", "p_now" timestamp with time zone, "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_submission_rate_limit_by_token_v1"("p_token" "text", "p_now" timestamp with time zone, "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_submission_rate_limit_v1"("p_token_id" "uuid", "p_now" timestamp with time zone, "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_submission_rate_limit_v1"("p_token_id" "uuid", "p_now" timestamp with time zone, "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_submission_rate_limit_v1"("p_token_id" "uuid", "p_now" timestamp with time zone, "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."form_submissions_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."form_submissions_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."form_submissions_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_feature_flag_v1"("p_workspace_id" "uuid", "p_feature_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_feature_flag_v1"("p_workspace_id" "uuid", "p_feature_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_feature_flag_v1"("p_workspace_id" "uuid", "p_feature_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_feature_flags_v1"("p_workspace_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_feature_flags_v1"("p_workspace_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_feature_flags_v1"("p_workspace_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_latest_plugin_artifact_v1"("p_widget_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_latest_plugin_artifact_v1"("p_widget_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_latest_plugin_artifact_v1"("p_widget_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_submission_trace_by_public_id"("p_public_id" "text", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_submission_trace_by_public_id"("p_public_id" "text", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_submission_trace_by_public_id"("p_public_id" "text", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_token_id_from_string_v1"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_token_id_from_string_v1"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_token_id_from_string_v1"("p_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_widget_config_v1"("p_public_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_widget_config_v1"("p_public_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_widget_config_v1"("p_public_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_widget_config_with_token_v1"("p_public_id" "text", "p_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_widget_instance_v1"("p_public_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_widget_instance_with_token_v1"("p_public_id" "text", "p_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user_created"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user_created"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user_created"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ingest_submission_v1"("p_public_id" "text", "p_payload" "jsonb", "p_ip" "text", "p_ua" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_form_submission"("p_widget_instance_id" "text", "p_payload" "jsonb", "p_ip" "inet", "p_ua" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_workspace_member"("p_workspace_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_workspace_member"("p_workspace_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_workspace_member"("p_workspace_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_workspace_owner"("p_workspace_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_workspace_owner"("p_workspace_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_workspace_owner"("p_workspace_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."embed_tokens" TO "anon";
GRANT ALL ON TABLE "public"."embed_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."embed_tokens" TO "service_role";



GRANT ALL ON FUNCTION "public"."issue_embed_token_for_public_id_v1"("p_public_id" "text", "p_ttl_minutes" integer, "p_created_by" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."issue_embed_token_for_public_id_v1"("p_public_id" "text", "p_ttl_minutes" integer, "p_created_by" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."issue_embed_token_for_public_id_v1"("p_public_id" "text", "p_ttl_minutes" integer, "p_created_by" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."issue_embed_token_v1"("p_widget_instance_id" "uuid", "p_ttl_minutes" integer, "p_created_by" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."issue_embed_token_v1"("p_widget_instance_id" "uuid", "p_ttl_minutes" integer, "p_created_by" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."issue_embed_token_v1"("p_widget_instance_id" "uuid", "p_ttl_minutes" integer, "p_created_by" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."issue_oslo_token_for_public_id_v1"("p_public_id" "text", "p_ttl_minutes" integer, "p_created_by" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."issue_oslo_token_v1"("p_widget_instance_id" "uuid", "p_ttl_minutes" integer, "p_created_by" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."issue_widget_draft_token_v1"("p_widget_instance_id" "uuid", "p_ttl_minutes" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."issue_widget_draft_token_v1"("p_widget_instance_id" "uuid", "p_ttl_minutes" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."issue_widget_draft_token_v1"("p_widget_instance_id" "uuid", "p_ttl_minutes" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."ops_health_snapshot_v1"() TO "anon";
GRANT ALL ON FUNCTION "public"."ops_health_snapshot_v1"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ops_health_snapshot_v1"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ops_refresh_rollups_v1"() TO "anon";
GRANT ALL ON FUNCTION "public"."ops_refresh_rollups_v1"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ops_refresh_rollups_v1"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ops_run_retention_core_v1"("p_errors_cutoff" interval, "p_usage_cutoff" interval) TO "anon";
GRANT ALL ON FUNCTION "public"."ops_run_retention_core_v1"("p_errors_cutoff" interval, "p_usage_cutoff" interval) TO "authenticated";
GRANT ALL ON FUNCTION "public"."ops_run_retention_core_v1"("p_errors_cutoff" interval, "p_usage_cutoff" interval) TO "service_role";



GRANT ALL ON FUNCTION "public"."ops_run_retention_v1"() TO "anon";
GRANT ALL ON FUNCTION "public"."ops_run_retention_v1"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ops_run_retention_v1"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ops_run_retention_v1"("p_errors_cutoff" interval, "p_usage_cutoff" interval) TO "anon";
GRANT ALL ON FUNCTION "public"."ops_run_retention_v1"("p_errors_cutoff" interval, "p_usage_cutoff" interval) TO "authenticated";
GRANT ALL ON FUNCTION "public"."ops_run_retention_v1"("p_errors_cutoff" interval, "p_usage_cutoff" interval) TO "service_role";



GRANT ALL ON FUNCTION "public"."oslo_token_audit_v1"("p_widget_instance_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."oslo_token_audit_v1"("p_widget_instance_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."oslo_token_audit_v1"("p_widget_instance_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."process_contact_submission_v1"("p_public_id" "text", "p_payload" "jsonb", "p_ip" "inet", "p_ua" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."process_contact_submission_v1"("p_public_id" "text", "p_payload" "jsonb", "p_ip" "inet", "p_ua" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_contact_submission_v1"("p_public_id" "text", "p_payload" "jsonb", "p_ip" "inet", "p_ua" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."process_form_submission_v1"("p_widget_instance_id" "text", "p_payload" "jsonb", "p_ip" "inet", "p_ua" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."prune_submission_rate_windows_v1"("p_older_than" interval) TO "anon";
GRANT ALL ON FUNCTION "public"."prune_submission_rate_windows_v1"("p_older_than" interval) TO "authenticated";
GRANT ALL ON FUNCTION "public"."prune_submission_rate_windows_v1"("p_older_than" interval) TO "service_role";



GRANT ALL ON FUNCTION "public"."purge_oslo_tokens_expired_v1"() TO "anon";
GRANT ALL ON FUNCTION "public"."purge_oslo_tokens_expired_v1"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."purge_oslo_tokens_expired_v1"() TO "service_role";



GRANT ALL ON FUNCTION "public"."purge_usage_events_v1"("p_cutoff" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."purge_usage_events_v1"("p_cutoff" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."purge_usage_events_v1"("p_cutoff" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."purge_widget_fetch_errors_v1"("p_cutoff" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."purge_widget_fetch_errors_v1"("p_cutoff" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."purge_widget_fetch_errors_v1"("p_cutoff" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_usage_monthly_rollup_range_v1"("p_start" timestamp with time zone, "p_end" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_usage_monthly_rollup_range_v1"("p_start" timestamp with time zone, "p_end" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_usage_monthly_rollup_range_v1"("p_start" timestamp with time zone, "p_end" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_usage_monthly_rollup_v1"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_usage_monthly_rollup_v1"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_usage_monthly_rollup_v1"() TO "service_role";



GRANT ALL ON FUNCTION "public"."register_plugin_artifact_v1"("p_widget_id" "uuid", "p_version" "text", "p_content" "bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."register_plugin_artifact_v1"("p_widget_id" "uuid", "p_version" "text", "p_content" "bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."register_plugin_artifact_v1"("p_widget_id" "uuid", "p_version" "text", "p_content" "bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."retention_audit_v1"("p_usage_cutoff" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."retention_audit_v1"("p_usage_cutoff" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."retention_audit_v1"("p_usage_cutoff" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."revoke_embed_token_v1"("p_token_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."revoke_embed_token_v1"("p_token_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."revoke_embed_token_v1"("p_token_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."revoke_oslo_token_v1"("p_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."rotate_embed_token_v1"("p_token_id" "uuid", "p_ttl_minutes" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."rotate_embed_token_v1"("p_token_id" "uuid", "p_ttl_minutes" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."rotate_embed_token_v1"("p_token_id" "uuid", "p_ttl_minutes" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."rotate_oslo_token_v1"("p_old_token" "text", "p_ttl_minutes" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."run_performance_baseline_v1"() TO "anon";
GRANT ALL ON FUNCTION "public"."run_performance_baseline_v1"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."run_performance_baseline_v1"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_feature_flag_v1"("p_workspace_id" "uuid", "p_feature_key" "text", "p_enabled" boolean, "p_variant" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."set_feature_flag_v1"("p_workspace_id" "uuid", "p_feature_key" "text", "p_enabled" boolean, "p_variant" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_feature_flag_v1"("p_workspace_id" "uuid", "p_feature_key" "text", "p_enabled" boolean, "p_variant" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."test_usage_baseline_v1"("p_month" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."test_usage_baseline_v1"("p_month" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."test_usage_baseline_v1"("p_month" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."usage_rollup_audit_v1"("p_month" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."usage_rollup_audit_v1"("p_month" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."usage_rollup_audit_v1"("p_month" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."widget_submissions_fill_derived_v1"() TO "anon";
GRANT ALL ON FUNCTION "public"."widget_submissions_fill_derived_v1"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."widget_submissions_fill_derived_v1"() TO "service_role";



GRANT ALL ON FUNCTION "public"."widget_submissions_trace_ai"() TO "anon";
GRANT ALL ON FUNCTION "public"."widget_submissions_trace_ai"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."widget_submissions_trace_ai"() TO "service_role";



GRANT ALL ON TABLE "public"."agency_packages" TO "anon";
GRANT ALL ON TABLE "public"."agency_packages" TO "authenticated";
GRANT ALL ON TABLE "public"."agency_packages" TO "service_role";



GRANT ALL ON TABLE "public"."workspace_allocations" TO "anon";
GRANT ALL ON TABLE "public"."workspace_allocations" TO "authenticated";
GRANT ALL ON TABLE "public"."workspace_allocations" TO "service_role";



GRANT ALL ON TABLE "public"."agency_package_allocations" TO "anon";
GRANT ALL ON TABLE "public"."agency_package_allocations" TO "authenticated";
GRANT ALL ON TABLE "public"."agency_package_allocations" TO "service_role";



GRANT ALL ON TABLE "public"."billing_account_workspaces" TO "anon";
GRANT ALL ON TABLE "public"."billing_account_workspaces" TO "authenticated";
GRANT ALL ON TABLE "public"."billing_account_workspaces" TO "service_role";



GRANT ALL ON TABLE "public"."billing_accounts" TO "anon";
GRANT ALL ON TABLE "public"."billing_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."billing_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."feature_flags" TO "anon";
GRANT ALL ON TABLE "public"."feature_flags" TO "authenticated";
GRANT ALL ON TABLE "public"."feature_flags" TO "service_role";



GRANT ALL ON TABLE "public"."widget_submissions" TO "anon";
GRANT ALL ON TABLE "public"."widget_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."widget_submissions" TO "service_role";



GRANT UPDATE("ip") ON TABLE "public"."widget_submissions" TO "anon";



GRANT ALL ON TABLE "public"."form_submissions" TO "anon";
GRANT ALL ON TABLE "public"."form_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."form_submissions" TO "service_role";



GRANT ALL ON TABLE "public"."materialized_view_refresh_log" TO "anon";
GRANT ALL ON TABLE "public"."materialized_view_refresh_log" TO "authenticated";
GRANT ALL ON TABLE "public"."materialized_view_refresh_log" TO "service_role";



GRANT ALL ON TABLE "public"."oslo_tokens" TO "anon";
GRANT ALL ON TABLE "public"."oslo_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."oslo_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."performance_baseline_audit" TO "anon";
GRANT ALL ON TABLE "public"."performance_baseline_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."performance_baseline_audit" TO "service_role";



GRANT ALL ON TABLE "public"."plan_features" TO "anon";
GRANT ALL ON TABLE "public"."plan_features" TO "authenticated";
GRANT ALL ON TABLE "public"."plan_features" TO "service_role";



GRANT ALL ON TABLE "public"."plan_limits" TO "anon";
GRANT ALL ON TABLE "public"."plan_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."plan_limits" TO "service_role";



GRANT ALL ON TABLE "public"."plugin_artifacts" TO "anon";
GRANT ALL ON TABLE "public"."plugin_artifacts" TO "authenticated";
GRANT ALL ON TABLE "public"."plugin_artifacts" TO "service_role";



GRANT ALL ON TABLE "public"."plugin_artifacts_latest" TO "anon";
GRANT ALL ON TABLE "public"."plugin_artifacts_latest" TO "authenticated";
GRANT ALL ON TABLE "public"."plugin_artifacts_latest" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."submission_rate_window" TO "anon";
GRANT ALL ON TABLE "public"."submission_rate_window" TO "authenticated";
GRANT ALL ON TABLE "public"."submission_rate_window" TO "service_role";



GRANT ALL ON TABLE "public"."widget_instances" TO "anon";
GRANT ALL ON TABLE "public"."widget_instances" TO "authenticated";
GRANT ALL ON TABLE "public"."widget_instances" TO "service_role";



GRANT ALL ON TABLE "public"."widgets" TO "anon";
GRANT ALL ON TABLE "public"."widgets" TO "authenticated";
GRANT ALL ON TABLE "public"."widgets" TO "service_role";



GRANT ALL ON TABLE "public"."submission_trace" TO "anon";
GRANT ALL ON TABLE "public"."submission_trace" TO "authenticated";
GRANT ALL ON TABLE "public"."submission_trace" TO "service_role";



GRANT ALL ON TABLE "public"."test_migration" TO "anon";
GRANT ALL ON TABLE "public"."test_migration" TO "authenticated";
GRANT ALL ON TABLE "public"."test_migration" TO "service_role";



GRANT ALL ON TABLE "public"."usage_events" TO "anon";
GRANT ALL ON TABLE "public"."usage_events" TO "authenticated";
GRANT ALL ON TABLE "public"."usage_events" TO "service_role";



GRANT ALL ON TABLE "public"."usage_month_to_date_v1" TO "anon";
GRANT ALL ON TABLE "public"."usage_month_to_date_v1" TO "authenticated";
GRANT ALL ON TABLE "public"."usage_month_to_date_v1" TO "service_role";



GRANT ALL ON TABLE "public"."usage_monthly_rollup" TO "anon";
GRANT ALL ON TABLE "public"."usage_monthly_rollup" TO "authenticated";
GRANT ALL ON TABLE "public"."usage_monthly_rollup" TO "service_role";



GRANT ALL ON TABLE "public"."usage_monthly_rollup_health_v1" TO "anon";
GRANT ALL ON TABLE "public"."usage_monthly_rollup_health_v1" TO "authenticated";
GRANT ALL ON TABLE "public"."usage_monthly_rollup_health_v1" TO "service_role";



GRANT ALL ON TABLE "public"."usage_monthly_summary" TO "anon";
GRANT ALL ON TABLE "public"."usage_monthly_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."usage_monthly_summary" TO "service_role";



GRANT ALL ON TABLE "public"."usage_mtd_by_billing_account" TO "anon";
GRANT ALL ON TABLE "public"."usage_mtd_by_billing_account" TO "authenticated";
GRANT ALL ON TABLE "public"."usage_mtd_by_billing_account" TO "service_role";



GRANT ALL ON TABLE "public"."user_creation_audit" TO "anon";
GRANT ALL ON TABLE "public"."user_creation_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."user_creation_audit" TO "service_role";



GRANT ALL ON TABLE "public"."widget_claim_audit" TO "anon";
GRANT ALL ON TABLE "public"."widget_claim_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."widget_claim_audit" TO "service_role";



GRANT ALL ON TABLE "public"."v_claim_failures_24h" TO "anon";
GRANT ALL ON TABLE "public"."v_claim_failures_24h" TO "authenticated";
GRANT ALL ON TABLE "public"."v_claim_failures_24h" TO "service_role";



GRANT ALL ON TABLE "public"."v_claim_last_attempt" TO "anon";
GRANT ALL ON TABLE "public"."v_claim_last_attempt" TO "authenticated";
GRANT ALL ON TABLE "public"."v_claim_last_attempt" TO "service_role";



GRANT ALL ON TABLE "public"."widget_events" TO "anon";
GRANT ALL ON TABLE "public"."widget_events" TO "authenticated";
GRANT ALL ON TABLE "public"."widget_events" TO "service_role";



GRANT ALL ON TABLE "public"."widget_fetch_errors" TO "anon";
GRANT ALL ON TABLE "public"."widget_fetch_errors" TO "authenticated";
GRANT ALL ON TABLE "public"."widget_fetch_errors" TO "service_role";



GRANT ALL ON TABLE "public"."widget_schemas" TO "anon";
GRANT ALL ON TABLE "public"."widget_schemas" TO "authenticated";
GRANT ALL ON TABLE "public"."widget_schemas" TO "service_role";



GRANT ALL ON TABLE "public"."widget_templates" TO "anon";
GRANT ALL ON TABLE "public"."widget_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."widget_templates" TO "service_role";



GRANT ALL ON TABLE "public"."workspace_members" TO "anon";
GRANT ALL ON TABLE "public"."workspace_members" TO "authenticated";
GRANT ALL ON TABLE "public"."workspace_members" TO "service_role";



GRANT ALL ON TABLE "public"."workspace_recent_events" TO "anon";
GRANT ALL ON TABLE "public"."workspace_recent_events" TO "authenticated";
GRANT ALL ON TABLE "public"."workspace_recent_events" TO "service_role";



GRANT ALL ON TABLE "public"."workspaces" TO "anon";
GRANT ALL ON TABLE "public"."workspaces" TO "authenticated";
GRANT ALL ON TABLE "public"."workspaces" TO "service_role";



GRANT ALL ON TABLE "public"."workspaces_with_payer" TO "anon";
GRANT ALL ON TABLE "public"."workspaces_with_payer" TO "authenticated";
GRANT ALL ON TABLE "public"."workspaces_with_payer" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






RESET ALL;
