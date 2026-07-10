import { MarketingFeaturePage } from "@/components/landing/marketing-feature-page";
import { MARKETING_PAGES, pageMetadata } from "@/lib/marketing-content";
import { MOCK_REPORTS } from "@/lib/marketing-mocks";

const content = MARKETING_PAGES.reports!;

export const metadata = pageMetadata(content.title, content.description);

export default function ReportsPage() {
  return <MarketingFeaturePage content={content} mock={MOCK_REPORTS} />;
}
