import { TeamPageContent } from "@/components/landing/pages/team-pricing-pages";
import { MARKETING_PAGES, pageMetadata } from "@/lib/marketing-content";

const content = MARKETING_PAGES.team!;

export const metadata = pageMetadata(content.title, content.description);

export default function TeamPage() {
  return <TeamPageContent />;
}
