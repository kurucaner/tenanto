import { MarketingFeaturePage } from "@/components/landing/marketing-feature-page";
import { MARKETING_PAGES, pageMetadata } from "@/lib/marketing-content";
import { MOCK_INCOME } from "@/lib/marketing-mocks";

const content = MARKETING_PAGES.income!;

export const metadata = pageMetadata(content.title, content.description);

export default function IncomePage() {
  return <MarketingFeaturePage content={content} mock={MOCK_INCOME} />;
}
