import './bob_app.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="/dieter/tokens.css" />
        <link rel="stylesheet" href="/dieter/components/segmented/segmented.css" />
        <link rel="stylesheet" href="/dieter/components/button/button.css" />
        <link rel="stylesheet" href="/dieter/components/toggle/toggle.css" />
        <link rel="stylesheet" href="/dieter/components/popover/popover.css" />
        <link rel="stylesheet" href="/dieter/components/textfield/textfield.css" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
