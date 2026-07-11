import type {
  IExpenseImportParseResponse,
  IPropertyExpenseCategoryType,
} from "@/packages/shared";

function remapExpenseImportParseResponse(
  response: IExpenseImportParseResponse,
  categoryTypes: IPropertyExpenseCategoryType[]
): IExpenseImportParseResponse {
  if (categoryTypes.length === 0) {
    return response;
  }

  const mockCategoryIds = [
    ...new Set(
      response.files.flatMap((file) => (file.rows ?? []).map((row) => row.categoryId))
    ),
  ].sort((a, b) => a.localeCompare(b));

  const categoryIdByMockId = new Map(
    mockCategoryIds.map((mockId, index) => [
      mockId,
      categoryTypes[index % categoryTypes.length]?.id ?? categoryTypes[0]!.id,
    ])
  );

  const fallbackCategoryId = categoryTypes[0]!.id;

  return {
    files: response.files.map((file) => ({
      ...file,
      rows: file.rows?.map((row) => ({
        ...row,
        categoryId: categoryIdByMockId.get(row.categoryId) ?? fallbackCategoryId,
      })),
    })),
  };
}

export async function loadExpenseImportMockParseResponse(
  categoryTypes: IPropertyExpenseCategoryType[]
): Promise<IExpenseImportParseResponse> {
  const { default: mockResponse } = await import("@/mocks/parse-response.json");
  return remapExpenseImportParseResponse(
    mockResponse as IExpenseImportParseResponse,
    categoryTypes
  );
}
