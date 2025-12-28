import './bob_app.css';

const TOKYO_BASE = process.env.NEXT_PUBLIC_TOKYO_URL;
if (!TOKYO_BASE) {
  throw new Error('NEXT_PUBLIC_TOKYO_URL is required to load Dieter assets');
}
const DIETER_BASE = `${TOKYO_BASE}/dieter`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href={`${DIETER_BASE}/tokens/tokens.css`} />
        <link rel="stylesheet" href={`${DIETER_BASE}/components/segmented/segmented.css`} />
        <link rel="stylesheet" href={`${DIETER_BASE}/components/button/button.css`} />
        <link rel="stylesheet" href={`${DIETER_BASE}/components/toggle/toggle.css`} />
        <link rel="stylesheet" href={`${DIETER_BASE}/components/popover/popover.css`} />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&display=swap"
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
