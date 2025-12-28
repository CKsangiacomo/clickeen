import { NextResponse } from 'next/server';
import { getServiceClient } from '@paris/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type InstanceRow = {
  public_id: string;
  status: string;
  config: Record<string, unknown> | null;
  created_at: string;
  widget_id: string | null;
};

export async function GET() {
  try {
    const supabase = getServiceClient();

    const { data, error } = await supabase
      .from('widget_instances')
      .select('public_id, status, config, created_at, widget_id')
      .neq('status', 'inactive')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[Paris] Failed to fetch instances', error);
      return NextResponse.json({ error: 'DB_ERROR', details: 'Unable to load instances' }, { status: 500 });
    }

    const rows = (Array.isArray(data) ? data : []).filter((row): row is InstanceRow => {
      return (
        Boolean(row) &&
        typeof (row as any).public_id === 'string' &&
        typeof (row as any).status === 'string' &&
        typeof (row as any).created_at === 'string'
      );
    });

    const widgetIds = Array.from(
      new Set(
        rows
          .map((row) => row.widget_id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    );

    const widgetLookup = new Map<string, { type: string | null; name: string | null }>();
    if (widgetIds.length > 0) {
      const { data: widgetData, error: widgetError } = await supabase
        .from('widgets')
        .select('id, type, name')
        .in('id', widgetIds);
      if (widgetError) {
        console.error('[Paris] Failed to fetch widgets for instances', widgetError);
        return NextResponse.json({ error: 'DB_ERROR', details: 'Unable to load instances' }, { status: 500 });
      }
      (Array.isArray(widgetData) ? widgetData : []).forEach((widget: any) => {
        if (!widget?.id) return;
        widgetLookup.set(String(widget.id), { type: widget.type ?? null, name: widget.name ?? null });
      });
    }

    const instances = rows.map((row) => {
      const widget = row.widget_id ? widgetLookup.get(row.widget_id) : undefined;
      return {
        publicId: row.public_id,
        widgetname: widget?.type ?? 'unknown',
        displayName: widget?.name ?? row.public_id,
        config: row.config ?? {},
      };
    });

    return NextResponse.json({ instances });
  } catch (error) {
    console.error('[Paris] Failed to initialize Supabase client', error);
    return NextResponse.json(
      { error: 'SERVER_ERROR', details: 'Supabase service credentials are missing or invalid' },
      { status: 503 },
    );
  }
}
