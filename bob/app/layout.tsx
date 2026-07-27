import './bob_app.css';
import '../../dieter/styles.css';
import { Inter_Tight } from 'next/font/google';

const interTight = Inter_Tight({ subsets: ['latin'], weight: ['400', '500', '600', '700'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={interTight.className} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
