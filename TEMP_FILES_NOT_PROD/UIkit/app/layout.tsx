import type { Metadata } from "next";
import { Inter_Tight } from "next/font/google";
import "./globals.css";

const interTight = Inter_Tight({
    variable: "--font-inter-tight",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "Tickety",
    description: "Tickety",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html
            className="text-[calc(0.7rem+0.4vw)] max-[2300px]:text-[calc(0.7rem+0.33vw)] max-[2150px]:text-[calc(0.7rem+0.28vw)] max-4xl:text-[1rem]"
            lang="en"
        >
            <head>
                {/* Description no longer than 155 characters */}
                <meta
                    name="description"
                    content="Tickety – Coded SaaS Event Ticket Dashboard"
                />

                {/* Product Name */}
                <meta
                    name="product-name"
                    content="Tickety – Coded SaaS Event Ticket Dashboard"
                />

                {/* Twitter Card data */}
                <meta name="twitter:card" content="summary" />
                <meta name="twitter:site" content="@ui8" />
                <meta
                    name="twitter:title"
                    content="Tickety – Coded SaaS Event Ticket Dashboard"
                />
                <meta
                    name="twitter:description"
                    content="Fully coded Event Ticket Dashboard built with React and Tailwind"
                />
                <meta name="twitter:creator" content="@ui8" />
                {/* Twitter Summary card images must be at least 120x120px */}
                <meta
                    name="twitter:image"
                    content="https://tickety-two.vercel.app/twitter-card.png"
                />

                {/* Open Graph data for Facebook */}
                <meta
                    property="og:title"
                    content="Tickety – Coded SaaS Event Ticket Dashboard"
                />
                <meta property="og:type" content="Article" />
                <meta
                    property="og:url"
                    content="https://ui8.net/brain-studio/products/saas-event-ticket-platform-dashboard-ui-kit-coded"
                />
                <meta
                    property="og:image"
                    content="https://tickety-two.vercel.app/fb-og-image.png"
                />
                <meta
                    property="og:description"
                    content="Fully coded Event Ticket Dashboard built with React and Tailwind"
                />
                <meta
                    property="og:site_name"
                    content="Tickety – Coded SaaS Event Ticket Dashboard"
                />
                <meta property="fb:admins" content="132951670226590" />

                {/* Open Graph data for LinkedIn */}
                <meta
                    property="og:title"
                    content="Tickety – Coded SaaS Event Ticket Dashboard"
                />
                <meta
                    property="og:url"
                    content="https://ui8.net/brain-studio/products/saas-event-ticket-platform-dashboard-ui-kit-coded"
                />
                <meta
                    property="og:image"
                    content="https://tickety-two.vercel.app/linkedin-og-image.png"
                />
                <meta
                    property="og:description"
                    content="Fully coded Event Ticket Dashboard built with React and Tailwind"
                />

                {/* Open Graph data for Pinterest */}
                <meta
                    property="og:title"
                    content="Tickety – Coded SaaS Event Ticket Dashboard"
                />
                <meta
                    property="og:url"
                    content="https://ui8.net/brain-studio/products/saas-event-ticket-platform-dashboard-ui-kit-coded"
                />
                <meta
                    property="og:image"
                    content="https://tickety-two.vercel.app/pinterest-og-image.png"
                />
                <meta
                    property="og:description"
                    content="Fully coded Event Ticket Dashboard built with React and Tailwind"
                />
            </head>
            <body
                className={`${interTight.variable} font-inter-tight text-body-md text-gray-900 antialiased`}
            >
                {children}
            </body>
        </html>
    );
}
