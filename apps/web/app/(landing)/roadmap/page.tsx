import { RoadmapPageContent } from "@/components/landing/pages/roadmap-page";
import { MARKETING_PAGES, pageMetadata } from "@/lib/marketing-content";

const content = MARKETING_PAGES.roadmap!;

export const metadata = pageMetadata(content.title, content.description);

export default function RoadmapPage() {
  return <RoadmapPageContent />;
}
