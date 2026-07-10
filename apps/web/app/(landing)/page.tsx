import { ComplianceHomePage } from "@/components/landing/compliance-home-page";
import { APP_NAME } from "@/packages/shared";

const APP_DESCRIPTION =
  "Property management and accounting web application for rental operators.";

export const metadata = {
  description: `${APP_NAME} is a ${APP_DESCRIPTION} Sign in with Google or email to manage properties, leases, reservations, income, expenses, and financial reports.`,
  title: `${APP_NAME} — Property Management Application`,
};

export default function Home() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    applicationCategory: "BusinessApplication",
    description: APP_DESCRIPTION,
    name: APP_NAME,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    operatingSystem: "Web",
    url: "https://propertyos.app",
  };

  return (
    <>
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        type="application/ld+json"
      />
      <ComplianceHomePage />
    </>
  );
}
