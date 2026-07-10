import { MarketingFeaturePage } from "@/components/landing/marketing-feature-page";
import { MARKETING_PAGES, pageMetadata } from "@/lib/marketing-content";
import { MOCK_PORTFOLIO } from "@/lib/marketing-mocks";

const content = MARKETING_PAGES.portfolio!;

export const metadata = pageMetadata(content.title, content.description);

export default function PortfolioPage() {
  return <MarketingFeaturePage content={content} mock={MOCK_PORTFOLIO} />;
}
