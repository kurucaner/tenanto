import type { PoolClient } from "pg";

import type { IAppConfig } from "@/packages/shared";

import { mapAppConfigRow } from "./mappers";
import { pool } from "./pool";

export type AppConfigUpdatePatch = {
  appStoreUrl?: string | null;
  maintenanceMode?: boolean;
  minAndroidAppVersion?: string;
  minIosAppVersion?: string;
  playStoreUrl?: string | null;
};

export const appConfigDb = {
  async find(): Promise<IAppConfig | null> {
    const result = await pool.query("SELECT * FROM app_config LIMIT 1");
    if (result.rows.length === 0) return null;
    return mapAppConfigRow(result.rows[0]);
  },

  async updateWithClient(
    client: PoolClient,
    patch: AppConfigUpdatePatch
  ): Promise<IAppConfig | null> {
    const locked = await client.query("SELECT * FROM app_config LIMIT 1 FOR UPDATE");
    if (locked.rows.length === 0) return null;
    const row = locked.rows[0] as Record<string, unknown>;
    const minIos = patch.minIosAppVersion
      ? patch.minIosAppVersion
      : (row.min_ios_app_version as string);
    const minAndroid = patch.minAndroidAppVersion
      ? patch.minAndroidAppVersion
      : (row.min_android_app_version as string);
    const maintenance = patch.maintenanceMode
      ? patch.maintenanceMode
      : (row.maintenance_mode as boolean);
    const appStore = patch.appStoreUrl ? patch.appStoreUrl : (row.app_store_url as string | null);
    const playStore = patch.playStoreUrl
      ? patch.playStoreUrl
      : (row.play_store_url as string | null);

    const result = await client.query(
      `UPDATE app_config SET
        min_ios_app_version = $1,
        min_android_app_version = $2,
        maintenance_mode = $3,
        app_store_url = $4,
        play_store_url = $5
      WHERE id = $6
      RETURNING *`,
      [minIos, minAndroid, maintenance, appStore, playStore, row.id as number]
    );
    if (result.rows.length === 0) return null;
    return mapAppConfigRow(result.rows[0]);
  },
};
