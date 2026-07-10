import { AppPurposeSection } from "@/components/landing/app-purpose-section";
import { LandingPage } from "@/components/landing/landing-page";
import { APP_NAME } from "@/packages/shared";

export const metadata = {
  description: `${APP_NAME} is a property management and accounting platform for rental operators. Track properties, leases, reservations, income, expenses, and financial reports.`,
  title: `${APP_NAME} — Residence management, reimagined`,
};

export default function Home() {
  return <LandingPage purposeSection={<AppPurposeSection />} />;
}
