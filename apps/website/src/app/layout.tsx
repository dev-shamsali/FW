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
  openGraph: { type: "website", siteName: site.name, title, description: site.description },
  twitter: { card: "summary", title, description: site.description },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e8edf0" },
    { media: "(prefers-color-scheme: dark)", color: "#0a131c" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
