import type { Metadata } from "next";
import { Inter, Lato } from "next/font/google";
import "./globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next";
import AppShellProviders from "@/components/AppShellProviders";

const inter = Inter({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "700", "900"],
  variable: "--font-inter",
  display: "swap",
});

const lato = Lato({
  subsets: ["latin"],
  weight: ["100", "300", "400", "700", "900"],
  variable: "--font-lato",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Oracle Games",
  description: "Oracle Games is hét platform voor fantasy sportliefhebbers. Speel diverse spellen, meet je met kenners of vrienden en beleef sport op een competitieve manier.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl">
      <head>
        <meta name="apple-mobile-web-app-title" content="Oracle games" />
      </head>
      <body
        className={`${inter.variable} ${lato.variable} antialiased bg-gray-50 overflow-x-hidden`}
        style={{ fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif' }}
      >
        <SpeedInsights />
        <AppShellProviders>{children}</AppShellProviders>
      </body>
    </html>
  );
}
