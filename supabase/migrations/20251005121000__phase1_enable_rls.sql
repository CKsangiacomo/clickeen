-- Enable RLS on key Phase-1 tables (idempotent where possible)
DO $$ BEGIN
  ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE widget_events ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE plan_limits ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

