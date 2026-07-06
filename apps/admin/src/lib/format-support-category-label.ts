import { CREATE_CATEGORY_OPTIONS } from "@/components/support/support-constants";
import { type SupportCategory } from "@/packages/shared";

export function formatSupportCategoryLabel(category: SupportCategory): string {
  return CREATE_CATEGORY_OPTIONS.find((opt) => opt.value === category)?.label ?? category;
}
