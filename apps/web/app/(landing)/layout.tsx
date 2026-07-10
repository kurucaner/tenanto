import "@/styles/landing.css";

import { Inter, Space_Grotesk } from "next/font/google";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-landing-display",
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-landing-body",
  weight: ["400", "500", "600"],
});

export default function LandingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className={`landing-root ${spaceGrotesk.variable} ${inter.variable}`}>{children}</div>
  );
}
