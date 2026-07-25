import './bob_app.css';
import { Inter_Tight } from 'next/font/google';
import Script from 'next/script';

const DIETER_BASE = '/dieter';
const interTight = Inter_Tight({ subsets: ['latin'], weight: ['400', '500', '600', '700'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href={`${DIETER_BASE}/editor/editor.css`} />
        <Script src={`${DIETER_BASE}/editor/editor.js`} strategy="beforeInteractive" />
      </head>
      <body className={interTight.className} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
