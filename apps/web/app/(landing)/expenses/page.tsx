import { MarketingFeaturePage } from "@/components/landing/marketing-feature-page";
import { MARKETING_PAGES, pageMetadata } from "@/lib/marketing-content";
import { MOCK_EXPENSES } from "@/lib/marketing-mocks";

const content = MARKETING_PAGES.expenses!;

export const metadata = pageMetadata(content.title, content.description);

export default function ExpensesPage() {
  return <MarketingFeaturePage content={content} mock={MOCK_EXPENSES} />;
}
