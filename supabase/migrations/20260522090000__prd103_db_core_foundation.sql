BEGIN;

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF to_regclass('public.accounts') IS NULL THEN
    RAISE EXCEPTION 'prd103_db_core_foundation requires existing public.accounts as migration source';
  END IF;
END $$;

CREATE TEMP TABLE prd103_accounts_source ON COMMIT DROP AS
SELECT
  public_id::text AS id,
  CASE
    WHEN status = 'disabled' THEN 'suspended'
    ELSE 'active'
  END AS status,
  COALESCE(NULLIF(tier, ''), 'free') AS tier,
  now() AS status_changed_at,
  COALESCE(created_at, now()) AS created_at
FROM public.accounts;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM prd103_accounts_source
    WHERE id IS NULL OR id !~ '^[0-9A-Z]{8}$'
  ) THEN
    RAISE EXCEPTION 'prd103 invalid compact account id in accounts source';
  END IF;

  IF EXISTS (
    SELECT id
    FROM prd103_accounts_source
    GROUP BY id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'prd103 duplicate compact account id in accounts source';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM prd103_accounts_source
    WHERE tier NOT IN ('free', 'tier1', 'tier2', 'tier3', 'tier4')
  ) THEN
    RAISE EXCEPTION 'prd103 invalid account tier in accounts source';
  END IF;
END $$;

CREATE TEMP TABLE prd103_users_source ON COMMIT DROP AS
WITH account_map AS (
  SELECT id AS old_account_id, public_id::text AS account_id
  FROM public.accounts
),
member_source AS (
  SELECT
    am.user_id,
    account_map.account_id,
    am.role,
    min(am.created_at) AS created_at
  FROM public.account_members am
  JOIN account_map ON account_map.old_account_id = am.account_id
  GROUP BY am.user_id, account_map.account_id, am.role
),
login_ranked AS (
  SELECT
    li.*,
    row_number() OVER (
      PARTITION BY li.user_id
      ORDER BY
        CASE lower(li.provider)
          WHEN 'google' THEN 1
          WHEN 'email' THEN 2
          ELSE 99
        END,
        li.created_at ASC NULLS LAST,
        li.id ASC
    ) AS rn
  FROM public.login_identities li
),
preferred_login AS (
  SELECT *
  FROM login_ranked
  WHERE rn = 1
)
SELECT
  up.user_id,
  ms.account_id,
  ms.role,
  lower(COALESCE(NULLIF(up.primary_email, ''), NULLIF(pl.email, '')))::citext AS primary_email,
  lower(pl.provider) AS login_provider,
  pl.provider_subject AS login_subject,
  NULLIF(up.given_name, '') AS first_name,
  NULL::text AS middle_name,
  NULLIF(up.family_name, '') AS last_name,
  NULLIF(up.primary_language, '') AS primary_language,
  CASE
    WHEN up.country IS NULL OR btrim(up.country::text) = '' THEN NULL
    ELSE upper(btrim(up.country::text))::char(2)
  END AS country,
  NULLIF(up.timezone, '') AS timezone,
  NULL::text AS phone,
  NULL::text AS whatsapp,
  COALESCE(up.created_at, ms.created_at, now()) AS created_at
FROM member_source ms
JOIN public.user_profiles up ON up.user_id = ms.user_id
LEFT JOIN preferred_login pl ON pl.user_id = ms.user_id;

DO $$
BEGIN
  IF EXISTS (
    SELECT user_id
    FROM public.account_members
    GROUP BY user_id
    HAVING count(DISTINCT account_id) > 1
  ) THEN
    RAISE EXCEPTION 'prd103 one user belongs to multiple accounts in source data';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM prd103_users_source
    WHERE account_id IS NULL
      OR role NOT IN ('owner', 'admin', 'editor', 'viewer')
      OR primary_email IS NULL
      OR login_provider NOT IN ('google', 'email')
      OR login_subject IS NULL
      OR login_subject = ''
  ) THEN
    RAISE EXCEPTION 'prd103 invalid user source row';
  END IF;

  IF EXISTS (
    SELECT primary_email
    FROM prd103_users_source
    GROUP BY primary_email
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'prd103 duplicate user primary_email in source data';
  END IF;

  IF EXISTS (
    SELECT login_provider, login_subject
    FROM prd103_users_source
    GROUP BY login_provider, login_subject
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'prd103 duplicate login provider/subject in source data';
  END IF;
END $$;

CREATE TEMP TABLE prd103_invitations_source ON COMMIT DROP AS
WITH account_map AS (
  SELECT id AS old_account_id, public_id::text AS account_id
  FROM public.accounts
)
SELECT
  ai.id,
  account_map.account_id,
  lower(ai.email)::citext AS email,
  ai.role,
  CASE
    WHEN ai.accepted_at IS NOT NULL THEN 'accepted'
    WHEN ai.revoked_at IS NOT NULL THEN 'revoked'
    ELSE 'pending'
  END AS status,
  COALESCE(ai.created_at, now()) AS created_at,
  ai.expires_at,
  ai.accepted_at,
  ai.revoked_at
FROM public.account_invitations ai
JOIN account_map ON account_map.old_account_id = ai.account_id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM prd103_invitations_source
    WHERE account_id IS NULL
      OR email IS NULL
      OR role NOT IN ('owner', 'admin', 'editor', 'viewer')
      OR status NOT IN ('pending', 'accepted', 'revoked')
      OR expires_at IS NULL
  ) THEN
    RAISE EXCEPTION 'prd103 invalid invitation source row';
  END IF;
END $$;

DO $$
DECLARE
  routine record;
BEGIN
  FOR routine IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'resolve_login_identity',
        'transfer_account_owner',
        'is_account_member',
        'is_account_admin',
        'is_account_editor',
        'normalize_asset_config_json',
        'normalize_asset_config_string'
      )
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', routine.signature);
  END LOOP;
END $$;

DROP TABLE IF EXISTS public.widget_instances CASCADE;
DROP TABLE IF EXISTS public.curated_widget_instances CASCADE;
DROP TABLE IF EXISTS public.widgets CASCADE;
DROP TABLE IF EXISTS public.l10n_publish_state CASCADE;
DROP TABLE IF EXISTS public.l10n_overlay_versions CASCADE;
DROP TABLE IF EXISTS public.l10n_generate_state CASCADE;
DROP TABLE IF EXISTS public.l10n_base_snapshots CASCADE;
DROP TABLE IF EXISTS public.widget_instance_overlays CASCADE;
DROP TABLE IF EXISTS public.widget_instance_locales CASCADE;
DROP TABLE IF EXISTS public.account_publish_containment CASCADE;
DROP TABLE IF EXISTS public.account_commercial_overrides CASCADE;
DROP TABLE IF EXISTS public.internal_control_events CASCADE;
DROP TABLE IF EXISTS public.user_contact_verifications CASCADE;
DROP TABLE IF EXISTS public.user_contact_methods CASCADE;
DROP TABLE IF EXISTS public.login_identities CASCADE;
DROP TABLE IF EXISTS public.account_members CASCADE;
DROP TABLE IF EXISTS public.account_invitations CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;
DROP TABLE IF EXISTS public.account_business_profiles CASCADE;
DROP TABLE IF EXISTS public.account_assets CASCADE;
DROP TABLE IF EXISTS public.account_asset_variants CASCADE;
DROP TABLE IF EXISTS public.workspaces CASCADE;
DROP TABLE IF EXISTS public.workspace_members CASCADE;
DROP TABLE IF EXISTS public.comments CASCADE;
DROP TABLE IF EXISTS public.account_notices CASCADE;
DROP TABLE IF EXISTS public.accounts CASCADE;

DROP TYPE IF EXISTS public.account_status CASCADE;
DROP TYPE IF EXISTS public.account_tier CASCADE;
DROP TYPE IF EXISTS public.user_role CASCADE;
DROP TYPE IF EXISTS public.login_provider CASCADE;
DROP TYPE IF EXISTS public.invitation_status CASCADE;
DROP TYPE IF EXISTS public.instance_publish_status CASCADE;
DROP TYPE IF EXISTS public.instance_translation_status CASCADE;

CREATE TYPE public.account_status AS ENUM ('active', 'suspended');
CREATE TYPE public.account_tier AS ENUM ('free', 'tier1', 'tier2', 'tier3', 'tier4');
CREATE TYPE public.user_role AS ENUM ('owner', 'admin', 'editor', 'viewer');
CREATE TYPE public.login_provider AS ENUM ('google', 'email');
CREATE TYPE public.invitation_status AS ENUM ('pending', 'accepted', 'revoked');
CREATE TYPE public.instance_publish_status AS ENUM ('unpublished', 'published');
CREATE TYPE public.instance_translation_status AS ENUM ('idle', 'queued', 'running', 'failed');

CREATE TABLE public.accounts (
  id text PRIMARY KEY CHECK (id ~ '^[0-9A-Z]{8}$'),
  status public.account_status NOT NULL,
  status_changed_at timestamptz NOT NULL,
  tier public.account_tier NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE INDEX accounts_suspended_status_changed_idx
  ON public.accounts (status_changed_at, id)
  WHERE status = 'suspended';

CREATE TABLE public.users (
  user_id uuid PRIMARY KEY,
  account_id text NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  role public.user_role NOT NULL,
  primary_email citext NOT NULL UNIQUE,
  login_provider public.login_provider NOT NULL,
  login_subject text NOT NULL CHECK (btrim(login_subject) <> ''),
  first_name text NULL,
  middle_name text NULL,
  last_name text NULL,
  primary_language text NULL CHECK (primary_language IS NULL OR primary_language ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
  country char(2) NULL CHECK (country IS NULL OR country ~ '^[A-Z]{2}$'),
  timezone text NULL CHECK (timezone IS NULL OR timezone !~ '\\s'),
  phone text NULL CHECK (phone IS NULL OR phone ~ '^\\+[1-9][0-9]{1,14}$'),
  whatsapp text NULL CHECK (whatsapp IS NULL OR whatsapp ~ '^\\+[1-9][0-9]{1,14}$'),
  created_at timestamptz NOT NULL,
  UNIQUE (login_provider, login_subject)
);

CREATE INDEX users_account_created_idx
  ON public.users (account_id, created_at, user_id);

CREATE TABLE public.account_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  email citext NOT NULL,
  role public.user_role NOT NULL,
  status public.invitation_status NOT NULL,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz NULL,
  revoked_at timestamptz NULL
);

CREATE INDEX account_invitations_account_status_created_idx
  ON public.account_invitations (account_id, status, created_at, id);

CREATE INDEX account_invitations_email_status_idx
  ON public.account_invitations (email, status);

CREATE TABLE public.instances (
  id text PRIMARY KEY CHECK (id ~ '^[0-9A-Z]{10}$'),
  account_id text NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  widget_type text NOT NULL CHECK (widget_type ~ '^[a-z0-9][a-z0-9_-]*$'),
  publish_status public.instance_publish_status NOT NULL DEFAULT 'unpublished',
  translation_status public.instance_translation_status NOT NULL DEFAULT 'idle',
  created_at timestamptz NOT NULL,
  edited_at timestamptz NOT NULL
);

CREATE INDEX instances_account_edited_idx
  ON public.instances (account_id, edited_at DESC, id);

CREATE INDEX instances_account_widget_type_idx
  ON public.instances (account_id, widget_type);

CREATE INDEX instances_account_published_idx
  ON public.instances (account_id, id)
  WHERE publish_status = 'published';

INSERT INTO public.accounts (id, status, status_changed_at, tier, created_at)
SELECT
  id,
  status::public.account_status,
  status_changed_at,
  tier::public.account_tier,
  created_at
FROM prd103_accounts_source;

INSERT INTO public.users (
  user_id,
  account_id,
  role,
  primary_email,
  login_provider,
  login_subject,
  first_name,
  middle_name,
  last_name,
  primary_language,
  country,
  timezone,
  phone,
  whatsapp,
  created_at
)
SELECT
  user_id,
  account_id,
  role::public.user_role,
  primary_email,
  login_provider::public.login_provider,
  login_subject,
  first_name,
  middle_name,
  last_name,
  primary_language,
  country,
  timezone,
  phone,
  whatsapp,
  created_at
FROM prd103_users_source;

INSERT INTO public.account_invitations (
  id,
  account_id,
  email,
  role,
  status,
  created_at,
  expires_at,
  accepted_at,
  revoked_at
)
SELECT
  id,
  account_id,
  email,
  role::public.user_role,
  status::public.invitation_status,
  created_at,
  expires_at,
  accepted_at,
  revoked_at
FROM prd103_invitations_source;

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY accounts_service_role_all
  ON public.accounts
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY users_service_role_all
  ON public.users
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY account_invitations_service_role_all
  ON public.account_invitations
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY instances_service_role_all
  ON public.instances
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.accounts FROM anon, authenticated;
REVOKE ALL ON public.users FROM anon, authenticated;
REVOKE ALL ON public.account_invitations FROM anon, authenticated;
REVOKE ALL ON public.instances FROM anon, authenticated;

GRANT ALL ON public.accounts TO service_role;
GRANT ALL ON public.users TO service_role;
GRANT ALL ON public.account_invitations TO service_role;
GRANT ALL ON public.instances TO service_role;

COMMIT;
