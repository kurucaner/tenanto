export interface IListTotalCountMeta {
  totalCount: number;
}

export interface IPropertyUnitsListMeta extends IListTotalCountMeta {
  longTermCount: number;
  shortTermCount: number;
}

export interface IPropertyLongStaysListMeta extends IListTotalCountMeta {
  activeCount: number;
  endedCount: number;
}

export type IPropertyExpensesListMeta = IListTotalCountMeta;

export type IPropertyIncomeEntriesListMeta = IListTotalCountMeta;

export type IPropertyIncomeLinesListMeta = IListTotalCountMeta;

export type IPropertyShortStaysListMeta = IListTotalCountMeta;

export type ITenantEmailCampaignsListMeta = IListTotalCountMeta;

export type IPropertyExportsListMeta = IListTotalCountMeta;
