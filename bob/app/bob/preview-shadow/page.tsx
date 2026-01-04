import { resolveVeniceBaseUrl } from '../../../lib/env/venice';
import Script from 'next/script';

export const runtime = 'edge';

type SearchParams = Record<string, string | string[] | undefined>;

export default async function PreviewShadowPage(props: { searchParams?: Promise<SearchParams> }) {
  const searchParams = (props.searchParams ? await props.searchParams : {}) ?? {};
  const publicId = typeof searchParams.publicId === 'string' ? searchParams.publicId : '';
  const theme = searchParams.theme === 'dark' ? 'dark' : 'light';
  const device = searchParams.device === 'mobile' ? 'mobile' : 'desktop';
  const veniceBase = resolveVeniceBaseUrl().replace(/\/+$/, '');
  const loaderSrc = `${veniceBase}/embed/latest/loader.js`;

  return (
    <main style={{ margin: 0, padding: 0 }}>
      <div style={{ width: '100%', minHeight: 420 }} />
      <Script
        src={loaderSrc}
        strategy="afterInteractive"
        data-public-id={publicId}
        data-trigger="immediate"
        data-force-shadow="true"
        data-theme={theme}
        data-device={device}
      />
    </main>
  );
}
