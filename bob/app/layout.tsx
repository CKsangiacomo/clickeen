import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bob · Clickeen',
  description: 'Builder surface for configuring Clickeen widgets.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="/dieter/tokens.css" />
        <link rel="stylesheet" href="/dieter/components/segmented.css" />
        <link rel="stylesheet" href="/dieter/components/button.css" />
        <link rel="stylesheet" href="/dieter/components/textfield.css" />
        <link rel="stylesheet" href="/dieter/components/textrename.css" />
        <link rel="stylesheet" href="/dieter/components/dropdown.css" />
        {/* Content-first preloads: ensure no FOUC for Content panel */}
        <link rel="stylesheet" href="/dieter/components/toggle.css" />
        <link rel="stylesheet" href="/dieter/components/expander.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
