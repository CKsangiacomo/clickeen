/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [],
  },
  headers: async () => [{
    source: "/(.*)",
    headers: [
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      {
        key: "Content-Security-Policy",
        value: `default-src 'self'; frame-src 'self' http://localhost:3002 https://c-keen-embed.vercel.app; script-src 'self'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval' 'unsafe-inline'" : " 'unsafe-inline'"}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: wss:;`
      }
    ]
  }]
};

export default nextConfig;
