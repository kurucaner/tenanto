import "./globals.css";

import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import Script from "next/script";

import { MotionConfigProvider } from "@/components/motion-config-provider";
import { Navbar } from "@/components/navbar";
import { TitleOnVisibility } from "@/components/title-on-visibility";
import { THEME_INIT_SCRIPT } from "@/lib/theme-preference";
import { APP_NAME } from "@/packages/shared";

const cormorant = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tenanto.app";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: APP_NAME,
  description: "Coming soon.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any", type: "image/x-icon" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${cormorant.variable} ${dmSans.variable} antialiased`}>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
        <Navbar />
        <MotionConfigProvider>{children}</MotionConfigProvider>
        <TitleOnVisibility />
      </body>
    </html>
  );
}
