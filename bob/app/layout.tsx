import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bob · Clickeen',
  description: 'Builder surface for configuring Clickeen widgets.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
