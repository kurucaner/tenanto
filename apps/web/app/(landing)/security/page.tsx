import { SecurityPageContent } from "@/components/landing/pages/security-contact-pages";
import { pageMetadata } from "@/lib/marketing-content";
import { APP_NAME } from "@/packages/shared";

export const metadata = pageMetadata(
  "Security",
  `Security, authentication, and data handling — ${APP_NAME}.`,
);

export default function SecurityPage() {
  return <SecurityPageContent />;
}
