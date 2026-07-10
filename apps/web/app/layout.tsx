import type { Metadata } from "next";

import { APP_NAME } from "@/packages/shared";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://propertyos.app";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: APP_NAME,
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
      <body>{children}</body>
    </html>
  );
}
