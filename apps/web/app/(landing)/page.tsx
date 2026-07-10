import { LandingPage } from "@/components/landing/landing-page";
import { APP_NAME } from "@/packages/shared";

export const metadata = {
  description: `${APP_NAME} — the operating system for modern residence management.`,
  title: `${APP_NAME} — Residence management, reimagined`,
};

export default function Home() {
  return <LandingPage />;
}
