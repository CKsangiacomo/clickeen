import { redirect } from 'next/navigation';

export const runtime = 'edge';

type WidgetPageProps = {
  params: Promise<{ publicId: string }>;
};

export default async function WidgetDetailPage({ params }: WidgetPageProps) {
  const { publicId } = await params;
  redirect(`/widgets?selected=${encodeURIComponent(publicId)}`);
}
