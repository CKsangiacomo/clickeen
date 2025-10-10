import './globals.css';

export const metadata = { title: 'Clickeen Studio' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: '"Inter Tight", "Inter", system-ui, -apple-system, "Segoe UI", sans-serif', color: '#111', background: '#f4f5f7', margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
