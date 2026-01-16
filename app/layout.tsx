import type { Metadata } from "next";
import { Inter, Lato, Nunito } from "next/font/google";
import "./globals.css";
import { Toaster } from 'react-hot-toast';
import { LayoutShell } from "@/components/LayoutShell";
import { AuthGuard } from "@/components/AuthGuard";
import MessageNotification from "@/components/MessageNotification";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
import { RankingsProvider } from "@/contexts/RankingsContext";
import LanguageWrapper from "@/components/LanguageWrapper";

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

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "700", "900"],
  variable: "--font-nunito",
  display: "swap",
})

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
        <LanguageWrapper>
          <ImpersonationProvider>
            <RankingsProvider autoLoad={true}>
              <Toaster position="top-center" />
              <MessageNotification />
              <AuthGuard>
                <LayoutShell>
                  <main>
                    {children}
                  </main>
                </LayoutShell>
              </AuthGuard>
            </RankingsProvider>
          </ImpersonationProvider>
        </LanguageWrapper>
      </body>
    </html>
  );
}
