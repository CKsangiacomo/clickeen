export const metadata = {
  title: 'Clickeen',
  description: 'Fast, lightweight widgets',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
