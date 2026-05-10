import { redirect } from 'next/navigation';

export const runtime = 'edge';

type WidgetPageProps = {
  params: Promise<{ instanceId: string }>;
};

export default async function WidgetDetailPage({ params }: WidgetPageProps) {
  const { instanceId } = await params;
  redirect(`/widgets?selected=${encodeURIComponent(instanceId)}`);
}
