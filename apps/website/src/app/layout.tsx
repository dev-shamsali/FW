import type { Metadata, Viewport } from "next";
import { Familjen_Grotesk, Martian_Mono } from "next/font/google";
import { site } from "../site";
import "./globals.css";

const sans = Familjen_Grotesk({ subsets: ["latin"], variable: "--font-familjen", display: "swap" });
const mono = Martian_Mono({ subsets: ["latin"], variable: "--font-martian", display: "swap" });

const title = `${site.name}: secure, convention-driven backend framework for Node.js`;

export const metadata: Metadata = {
  ...(site.siteUrl ? { metadataBase: new URL(site.siteUrl), alternates: { canonical: "/" } } : {}),
  title: { default: title, template: `%s · ${site.name}` },
  description: site.description,
  applicationName: site.name,
  authors: [{ name: site.author }],
  keywords: [
    "Node.js backend framework",
    "Express framework",
    "Express TypeScript framework",
    "TypeScript backend framework",
    "secure Express framework",
    "Node.js REST API framework",
    "Express CLI",
    "Node.js project generator",
  ],
  openGraph: {
    type: "website",
    siteName: site.name,
    title,
    description: site.description,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: `${site.name} logo` }],
  },
  twitter: { card: "summary_large_image", title, description: site.description, images: ["/og.png"] },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: 'try{var t=localStorage.getItem("rhea-theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}',
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
