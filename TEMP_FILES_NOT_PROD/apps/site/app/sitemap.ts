export default async function sitemap() {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  return [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${base}/widgets/contact-form`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/it/widgets/contact-form`, changeFrequency: 'weekly', priority: 0.8 }
  ];
}
