BEGIN;

INSERT INTO public.instances (
  id,
  account_id,
  widget_type,
  publish_status,
  translation_status,
  created_at,
  edited_at
) VALUES
  (
    'H7IF9M2K9B',
    '00000001',
    'countdown',
    'published'::public.instance_publish_status,
    'idle'::public.instance_translation_status,
    '2026-04-27T16:01:54.928Z'::timestamptz,
    '2026-05-16T18:45:23.332Z'::timestamptz
  ),
  (
    'UZ3JEJSHII',
    '00000001',
    'faq',
    'published'::public.instance_publish_status,
    'idle'::public.instance_translation_status,
    '2026-04-28T05:40:25.169Z'::timestamptz,
    '2026-05-20T13:07:54.681Z'::timestamptz
  ),
  (
    '8FMVZFFPJV',
    '00000001',
    'logoshowcase',
    'published'::public.instance_publish_status,
    'idle'::public.instance_translation_status,
    '2026-04-27T16:01:41.366Z'::timestamptz,
    '2026-05-16T18:45:38.776Z'::timestamptz
  )
ON CONFLICT (id) DO UPDATE
SET
  account_id = EXCLUDED.account_id,
  widget_type = EXCLUDED.widget_type,
  publish_status = EXCLUDED.publish_status,
  translation_status = EXCLUDED.translation_status,
  created_at = EXCLUDED.created_at,
  edited_at = EXCLUDED.edited_at;

COMMIT;
