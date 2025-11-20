-- Seed Geneva tables with Phase-1 widget schemas and templates
-- This migration provides the minimum data required for Phase-1 operation.
--
-- References:
-- - documentation/systems/geneva.md (Schema Registry PRD)
-- - documentation/CRITICAL-TECHPHASES/Techphases-Phase1Specs.md (Phase-1 contracts)

-- =============================================================================
-- widget_schemas: JSON Schema definitions for widget config validation
-- =============================================================================

-- forms.contact v2025-09-01
INSERT INTO widget_schemas (widget_type, schema_version, schema)
VALUES (
  'forms.contact',
  '2025-09-01',
  jsonb_build_object(
    '$schema', 'http://json-schema.org/draft-07/schema#',
    'type', 'object',
    'additionalProperties', false,
    'required', ARRAY['title', 'fields', 'successMessage'],
    'properties', jsonb_build_object(
      'title', jsonb_build_object(
        'type', 'string',
        'minLength', 1,
        'maxLength', 100,
        'default', 'Contact Us'
      ),
      'fields', jsonb_build_object(
        'type', 'object',
        'additionalProperties', false,
        'properties', jsonb_build_object(
          'name', jsonb_build_object('type', 'boolean', 'default', true),
          'email', jsonb_build_object('type', 'boolean', 'default', true),
          'message', jsonb_build_object('type', 'boolean', 'default', true)
        ),
        'default', jsonb_build_object('name', true, 'email', true, 'message', true)
      ),
      'successMessage', jsonb_build_object(
        'type', 'string',
        'minLength', 1,
        'maxLength', 200,
        'default', 'Thanks for reaching out!'
      )
    )
  )
)
ON CONFLICT (widget_type, schema_version) DO NOTHING;

-- content.faq v2025-09-01
INSERT INTO widget_schemas (widget_type, schema_version, schema)
VALUES (
  'content.faq',
  '2025-09-01',
  jsonb_build_object(
    '$schema', 'http://json-schema.org/draft-07/schema#',
    'type', 'object',
    'additionalProperties', false,
    'required', ARRAY['title', 'items'],
    'properties', jsonb_build_object(
      'title', jsonb_build_object('type', 'string', 'default', 'Frequently Asked Questions'),
      'items', jsonb_build_object(
        'type', 'array',
        'items', jsonb_build_object(
          'type', 'object',
          'required', ARRAY['question', 'answer'],
          'properties', jsonb_build_object(
            'question', jsonb_build_object('type', 'string'),
            'answer', jsonb_build_object('type', 'string')
          )
        ),
        'minItems', 1,
        'maxItems', 20,
        'default', jsonb_build_array()
      )
    )
  )
)
ON CONFLICT (widget_type, schema_version) DO NOTHING;

-- engagement.newsletter v2025-09-01
INSERT INTO widget_schemas (widget_type, schema_version, schema)
VALUES (
  'engagement.newsletter',
  '2025-09-01',
  jsonb_build_object(
    '$schema', 'http://json-schema.org/draft-07/schema#',
    'type', 'object',
    'additionalProperties', false,
    'required', ARRAY['headline', 'subheadline'],
    'properties', jsonb_build_object(
      'headline', jsonb_build_object('type', 'string', 'default', 'Stay Updated'),
      'subheadline', jsonb_build_object('type', 'string', 'default', 'Subscribe to our newsletter')
    )
  )
)
ON CONFLICT (widget_type, schema_version) DO NOTHING;

-- engagement.announcement v2025-09-01
INSERT INTO widget_schemas (widget_type, schema_version, schema)
VALUES (
  'engagement.announcement',
  '2025-09-01',
  jsonb_build_object(
    '$schema', 'http://json-schema.org/draft-07/schema#',
    'type', 'object',
    'additionalProperties', false,
    'required', ARRAY['message'],
    'properties', jsonb_build_object(
      'message', jsonb_build_object('type', 'string', 'default', 'Important announcement'),
      'link', jsonb_build_object('type', 'string', 'format', 'uri'),
      'dismissable', jsonb_build_object('type', 'boolean', 'default', true)
    )
  )
)
ON CONFLICT (widget_type, schema_version) DO NOTHING;

-- social.testimonials v2025-09-01
INSERT INTO widget_schemas (widget_type, schema_version, schema)
VALUES (
  'social.testimonials',
  '2025-09-01',
  jsonb_build_object(
    '$schema', 'http://json-schema.org/draft-07/schema#',
    'type', 'object',
    'additionalProperties', false,
    'required', ARRAY['items'],
    'properties', jsonb_build_object(
      'items', jsonb_build_object(
        'type', 'array',
        'items', jsonb_build_object(
          'type', 'object',
          'required', ARRAY['quote', 'author'],
          'properties', jsonb_build_object(
            'quote', jsonb_build_object('type', 'string'),
            'author', jsonb_build_object('type', 'string'),
            'role', jsonb_build_object('type', 'string')
          )
        ),
        'minItems', 1,
        'maxItems', 10,
        'default', jsonb_build_array()
      )
    )
  )
)
ON CONFLICT (widget_type, schema_version) DO NOTHING;

-- social.proof v2025-09-01
INSERT INTO widget_schemas (widget_type, schema_version, schema)
VALUES (
  'social.proof',
  '2025-09-01',
  jsonb_build_object(
    '$schema', 'http://json-schema.org/draft-07/schema#',
    'type', 'object',
    'additionalProperties', false,
    'required', ARRAY['metric', 'label'],
    'properties', jsonb_build_object(
      'metric', jsonb_build_object('type', 'string', 'default', '10,000+'),
      'label', jsonb_build_object('type', 'string', 'default', 'Happy Customers')
    )
  )
)
ON CONFLICT (widget_type, schema_version) DO NOTHING;

-- =============================================================================
-- widget_templates: Template descriptors for each widget type
-- =============================================================================

-- forms.contact: classic-light
INSERT INTO widget_templates (
  widget_type, template_id, name, layout, skin, density, premium, schema_version, defaults, descriptor
)
VALUES (
  'forms.contact',
  'classic-light',
  'Classic Light',
  'STACKED',
  'MINIMAL',
  'COZY',
  false,
  '2025-09-01',
  jsonb_build_object(
    'title', 'Contact Us',
    'fields', jsonb_build_object('name', true, 'email', true, 'message', true),
    'successMessage', 'Thanks for reaching out! We will get back to you shortly.'
  ),
  jsonb_build_object(
    'layout', 'STACKED',
    'skin', 'MINIMAL',
    'density', 'COZY',
    'accents', jsonb_build_array()
  )
)
ON CONFLICT (template_id) DO NOTHING;

-- content.faq: classic-light
INSERT INTO widget_templates (
  widget_type, template_id, name, layout, skin, density, premium, schema_version, defaults, descriptor
)
VALUES (
  'content.faq',
  'faq-classic-light',
  'FAQ Classic Light',
  'ACCORDION',
  'MINIMAL',
  'COZY',
  false,
  '2025-09-01',
  jsonb_build_object(
    'title', 'Frequently Asked Questions',
    'items', jsonb_build_array()
  ),
  jsonb_build_object(
    'layout', 'ACCORDION',
    'skin', 'MINIMAL',
    'density', 'COZY'
  )
)
ON CONFLICT (template_id) DO NOTHING;

-- engagement.newsletter: classic-light
INSERT INTO widget_templates (
  widget_type, template_id, name, layout, skin, density, premium, schema_version, defaults, descriptor
)
VALUES (
  'engagement.newsletter',
  'newsletter-classic-light',
  'Newsletter Classic Light',
  'INLINE',
  'MINIMAL',
  'COZY',
  false,
  '2025-09-01',
  jsonb_build_object(
    'headline', 'Stay Updated',
    'subheadline', 'Subscribe to our newsletter'
  ),
  jsonb_build_object(
    'layout', 'INLINE',
    'skin', 'MINIMAL',
    'density', 'COZY'
  )
)
ON CONFLICT (template_id) DO NOTHING;

-- engagement.announcement: classic-light
INSERT INTO widget_templates (
  widget_type, template_id, name, layout, skin, density, premium, schema_version, defaults, descriptor
)
VALUES (
  'engagement.announcement',
  'announcement-classic-light',
  'Announcement Classic Light',
  'CARD',
  'MINIMAL',
  'COZY',
  false,
  '2025-09-01',
  jsonb_build_object(
    'message', 'Important announcement',
    'dismissable', true
  ),
  jsonb_build_object(
    'layout', 'CARD',
    'skin', 'MINIMAL',
    'density', 'COZY'
  )
)
ON CONFLICT (template_id) DO NOTHING;

-- social.testimonials: classic-light
INSERT INTO widget_templates (
  widget_type, template_id, name, layout, skin, density, premium, schema_version, defaults, descriptor
)
VALUES (
  'social.testimonials',
  'testimonials-classic-light',
  'Testimonials Classic Light',
  'CAROUSEL',
  'MINIMAL',
  'COZY',
  false,
  '2025-09-01',
  jsonb_build_object(
    'items', jsonb_build_array()
  ),
  jsonb_build_object(
    'layout', 'CAROUSEL',
    'skin', 'MINIMAL',
    'density', 'COZY'
  )
)
ON CONFLICT (template_id) DO NOTHING;

-- social.proof: classic-light
INSERT INTO widget_templates (
  widget_type, template_id, name, layout, skin, density, premium, schema_version, defaults, descriptor
)
VALUES (
  'social.proof',
  'social-proof-classic-light',
  'Social Proof Classic Light',
  'INLINE',
  'MINIMAL',
  'COZY',
  false,
  '2025-09-01',
  jsonb_build_object(
    'metric', '10,000+',
    'label', 'Happy Customers'
  ),
  jsonb_build_object(
    'layout', 'INLINE',
    'skin', 'MINIMAL',
    'density', 'COZY'
  )
)
ON CONFLICT (template_id) DO NOTHING;
