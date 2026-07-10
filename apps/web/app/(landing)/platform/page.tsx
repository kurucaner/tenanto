import { PlatformPageContent } from "@/components/landing/pages/platform-page";
import { MARKETING_PAGES, pageMetadata } from "@/lib/marketing-content";

const content = MARKETING_PAGES.platform!;

export const metadata = pageMetadata(content.title, content.description);

export default function PlatformPage() {
  return <PlatformPageContent />;
}
