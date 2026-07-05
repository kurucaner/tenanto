export interface IAppConfig {
  appStoreUrl: string | null;
  id: number;
  maintenanceMode: boolean;
  minAndroidAppVersion: string;
  minIosAppVersion: string;
  playStoreUrl: string | null;
  updatedAt: string;
}

/** Body for PATCH /admin/app-config (all fields optional; at least one required). */
export interface IAdminPatchAppConfigBody {
  appStoreUrl?: string | null;
  maintenanceMode?: boolean;
  minAndroidAppVersion?: string;
  minIosAppVersion?: string;
  playStoreUrl?: string | null;
}

export interface IInitResponse {
  apiVersion: string;
  appStoreUrl: string | null;
  dbVersion: number;
  forceUpdate: boolean;
  maintenanceMode: boolean;
  minAndroidAppVersion: string;
  minIosAppVersion: string;
  playStoreUrl: string | null;
}

export type TPlatform = "ios" | "android";
