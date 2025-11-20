import './bob_app.css';

const DENVER_BASE = process.env.NEXT_PUBLIC_DENVER_URL || '';
const DIETER_BASE = `${DENVER_BASE}/dieter`;

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
        <link rel="stylesheet" href={`${DIETER_BASE}/components/textfield/textfield.css`} />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&display=swap"
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
