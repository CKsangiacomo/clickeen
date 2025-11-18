import { NextResponse } from 'next/server';
import { getServiceClient } from '@paris/lib/supabaseAdmin';

export const runtime = 'nodejs';

type InstanceRow = {
  inst_public_id: string;
  inst_instancedata: Record<string, unknown> | null;
  inst_status: string | null;
  inst_widget_name: string | null;
  inst_display_name: string | null;
};

export async function GET() {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('widget_instances')
    .select('inst_public_id, inst_instancedata, inst_status, inst_widget_name, inst_display_name')
    .neq('inst_status', 'inactive')
    .order('inst_created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[Paris] Failed to fetch instances', error);
    return NextResponse.json({ error: 'DB_ERROR', details: 'Unable to load instances' }, { status: 500 });
  }

  const instances = (Array.isArray(data) ? data : [])
    .filter((row): row is InstanceRow => Boolean(row && row.inst_public_id))
    .map((row) => ({
      publicId: row.inst_public_id,
      widgetname: row.inst_widget_name ?? 'unknown',
      displayName: row.inst_display_name ?? row.inst_public_id,
      config: row.inst_instancedata ?? {},
    }));

  return NextResponse.json({ instances });
}
