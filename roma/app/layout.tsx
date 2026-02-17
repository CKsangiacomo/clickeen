import './roma.css';
import { Inter_Tight } from 'next/font/google';
import { resolveTokyoBaseUrl } from '../lib/env/tokyo';

const TOKYO_BASE = resolveTokyoBaseUrl();
const DIETER_BASE = `${TOKYO_BASE}/dieter`;
const interTight = Inter_Tight({ subsets: ['latin'], weight: ['400', '500', '600', '700'] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href={`${DIETER_BASE}/tokens/tokens.css`} />
        <link rel="stylesheet" href={`${DIETER_BASE}/components/segmented/segmented.css`} />
        <link rel="stylesheet" href={`${DIETER_BASE}/components/button/button.css`} />
        <link rel="stylesheet" href={`${DIETER_BASE}/components/textfield/textfield.css`} />
        <link rel="stylesheet" href={`${DIETER_BASE}/components/toggle/toggle.css`} />
        <link rel="stylesheet" href={`${DIETER_BASE}/components/popover/popover.css`} />
      </head>
      <body className={interTight.className}>{children}</body>
    </html>
  );
}
