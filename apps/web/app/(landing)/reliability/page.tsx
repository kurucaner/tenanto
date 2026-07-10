import { MarketingFeaturePage } from "@/components/landing/marketing-feature-page";
import { MARKETING_PAGES, pageMetadata } from "@/lib/marketing-content";

const content = MARKETING_PAGES.reliability!;

export const metadata = pageMetadata(content.title, content.description);

export default function ReliabilityPage() {
  return <MarketingFeaturePage content={content} />;
}
