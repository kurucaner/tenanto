import { MarketingFeaturePage } from "@/components/landing/marketing-feature-page";
import { MARKETING_PAGES, pageMetadata } from "@/lib/marketing-content";
import { MOCK_LTR } from "@/lib/marketing-mocks";

const content = MARKETING_PAGES["long-term-leases"]!;

export const metadata = pageMetadata(content.title, content.description);

export default function LongTermLeasesPage() {
  return <MarketingFeaturePage content={content} mock={MOCK_LTR} />;
}
