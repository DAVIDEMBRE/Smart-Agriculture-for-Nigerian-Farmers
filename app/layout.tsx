import type { Metadata, Viewport } from "next";
import { Manrope, IBM_Plex_Mono } from "next/font/google";
import { AppProvider, themeBootstrapScript } from "@/components/app-provider";
import { PwaRegister } from "@/components/pwa-register";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://smart-farming-rural-nigeria.vercel.app"),
  title: { default: "Smart Farming for Rural Nigeria", template: "%s | Smart Farming Nigeria" },
  description: "Research-backed crop recommendation and live Uyo weather for rural Nigerian agriculture.",
  applicationName: "Smart Farming for Rural Nigeria",
  authors: [{ name: "David Edet Mbre" }],
  manifest: "/manifest.webmanifest",
  icons: [{ rel: "icon", url: "/icon.svg" }],
  appleWebApp: { capable: true, title: "Smart Farming NG", statusBarStyle: "default" },
  openGraph: {
    title: "Smart Farming for Rural Nigeria",
    description: "Measure conditions. Explore a crop recommendation. Understand the limits.",
    images: ["/generated/hero-farm.jpg"],
    type: "website",
    locale: "en_NG",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f7f1" },
    { media: "(prefers-color-scheme: dark)", color: "#0c1712" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-NG" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className={`${manrope.variable} ${plexMono.variable}`}>
        <AppProvider>
          <SiteHeader />
          {children}
          <SiteFooter />
          <PwaRegister />
        </AppProvider>
      </body>
    </html>
  );
}
