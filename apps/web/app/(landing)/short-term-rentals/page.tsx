import { MarketingFeaturePage } from "@/components/landing/marketing-feature-page";
import { MARKETING_PAGES, pageMetadata } from "@/lib/marketing-content";
import { MOCK_STR } from "@/lib/marketing-mocks";

const content = MARKETING_PAGES["short-term-rentals"]!;

export const metadata = pageMetadata(content.title, content.description);

export default function ShortTermRentalsPage() {
  return <MarketingFeaturePage content={content} mock={MOCK_STR} showChannels />;
}
