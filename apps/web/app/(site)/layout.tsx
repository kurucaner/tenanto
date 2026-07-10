import "../globals.css";

import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import Script from "next/script";

import { MotionConfigProvider } from "@/components/motion-config-provider";
import { Navbar } from "@/components/navbar";
import { TitleOnVisibility } from "@/components/title-on-visibility";
import { THEME_INIT_SCRIPT } from "@/lib/theme-preference";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["300", "400", "500", "600", "700"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

export default function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className={`${cormorant.variable} ${dmSans.variable} antialiased`}>
      <Script
        dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        id="theme-init"
        strategy="beforeInteractive"
      />
      <Navbar />
      <MotionConfigProvider>{children}</MotionConfigProvider>
      <TitleOnVisibility />
    </div>
  );
}
