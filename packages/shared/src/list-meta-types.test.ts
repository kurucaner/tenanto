import { describe, expect, test } from "bun:test";

import type {
  IListTotalCountMeta,
  IPropertyExpensesListMeta,
  IPropertyLongStaysListMeta,
  IPropertyUnitsListMeta,
} from "./list-meta-types";
import type {
  TPrimaryTenantContactSource,
  TSecondaryTenantContactSource,
} from "./tenant-contact-source-types";

describe("list meta types", () => {
  test("IListTotalCountMeta aliases preserve totalCount-only shape", () => {
    const meta: IPropertyExpensesListMeta = { totalCount: 12 };
    const totalMeta: IListTotalCountMeta = meta;
    expect(totalMeta.totalCount).toBe(12);
  });

  test("IPropertyLongStaysListMeta extends total count meta", () => {
    const meta: IPropertyLongStaysListMeta = {
      activeCount: 3,
      endedCount: 2,
      totalCount: 5,
    };
    const totalMeta: IListTotalCountMeta = meta;
    expect(totalMeta.totalCount).toBe(5);
  });

  test("IPropertyUnitsListMeta extends total count meta", () => {
    const meta: IPropertyUnitsListMeta = {
      longTermCount: 4,
      shortTermCount: 1,
      totalCount: 5,
    };
    const totalMeta: IListTotalCountMeta = meta;
    expect(totalMeta.totalCount).toBe(5);
  });
});

describe("tenant contact source types", () => {
  test("primary and secondary sources share linked and pending literals", () => {
    const linked: TPrimaryTenantContactSource = "linked_user";
    const pendingSecondary: TSecondaryTenantContactSource = "membership_pending";
    expect(linked).toBe("linked_user");
    expect(pendingSecondary).toBe("membership_pending");
  });
});
