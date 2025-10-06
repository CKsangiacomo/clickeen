-- Template & schema tables per documentation/systems/michael.md
CREATE TABLE IF NOT EXISTS widget_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  widget_type TEXT NOT NULL,
  template_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  layout TEXT CHECK (layout IN ('LIST','GRID','CAROUSEL','CARD','ACCORDION','MARQUEE','STACKED','INLINE')),
  skin TEXT CHECK (skin IN ('MINIMAL','SOFT','SHARP','GLASS')),
  density TEXT CHECK (density IN ('COZY','COMPACT')),
  accents TEXT[],
  premium BOOLEAN DEFAULT false,
  schema_version TEXT NOT NULL,
  defaults JSONB DEFAULT '{}',
  descriptor JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS widget_schemas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  widget_type TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  schema JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(widget_type, schema_version)
);

