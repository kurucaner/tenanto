import { ContactPageContent } from "@/components/landing/pages/security-contact-pages";
import { pageMetadata } from "@/lib/marketing-content";
import { APP_NAME } from "@/packages/shared";

export const metadata = pageMetadata(
  "Contact",
  `Contact ${APP_NAME} for demos, pilots, and support.`
);

export default function ContactPage() {
  return <ContactPageContent />;
}
