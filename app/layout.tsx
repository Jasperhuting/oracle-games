import type { Metadata } from "next";
import { headers } from "next/headers";
import { Inter, Lato } from "next/font/google";
import "./globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next";
import AppShellProviders from "@/components/AppShellProviders";
import { getPlatformConfigFromHost } from "@/lib/platform";

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const host = (await headers()).get("host");
  const platform = getPlatformConfigFromHost(host);

  return (
    <html lang="nl" data-platform={platform.key}>
      <head>
        <meta name="apple-mobile-web-app-title" content="Oracle games" />
      </head>
      <body
        className={`${inter.variable} ${lato.variable} antialiased overflow-x-hidden`}
        style={{
          fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
          background: "var(--platform-page-bg)",
          color: "var(--platform-text-color)",
        }}
      >
        <SpeedInsights />
        <AppShellProviders>{children}</AppShellProviders>
      </body>
    </html>
  );
}
