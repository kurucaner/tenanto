import { LandingPage } from "@/components/landing/landing-page";
import { APP_NAME } from "@/packages/shared";

export const metadata = {
  description: `${APP_NAME} — property accounting for short-term and long-term rental operators. Track stays, leases, income, expenses, and portfolio reports.`,
  title: `${APP_NAME} — Property accounting, reimagined`,
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  applicationCategory: "BusinessApplication",
  description: metadata.description,
  name: APP_NAME,
  offers: {
    "@type": "Offer",
    description: "14-day free pilot",
    price: "0",
    priceCurrency: "USD",
  },
  operatingSystem: "Web",
};

export default function Home() {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        type="application/ld+json"
      />
      <LandingPage />
    </>
  );
}
