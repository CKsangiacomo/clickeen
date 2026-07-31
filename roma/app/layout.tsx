import '../../dieter/styles.css';
import '../../dieter/layouts/main-container/main-container.css';
import './roma.css';
import { Inter_Tight } from 'next/font/google';
import type { Viewport } from 'next';

const interTight = Inter_Tight({ subsets: ['latin'], weight: ['400', '500', '600', '700'] });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${interTight.className} body-s`}>{children}</body>
    </html>
  );
}
