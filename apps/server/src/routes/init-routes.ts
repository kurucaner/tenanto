import { readFileSync } from "node:fs";
import path from "node:path";

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import semver from "semver";

import { appConfigDb } from "@/db/app-config";
import { pool } from "@/db/pool";
import type { IInitResponse, TPlatform } from "@/packages/shared";
import { HttpStatus } from "@/packages/shared";

const serverPkg = JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf-8")) as {
  version?: string;
};
const API_VERSION = serverPkg.version ?? "0.0.0";

async function getDbVersion(): Promise<number> {
  const result = await pool.query(
    "SELECT COALESCE(MAX(version), 0)::int AS version FROM migrations"
  );
  return (result.rows[0]?.version as number) ?? 0;
}

function computeForceUpdate(
  appVersion: string | undefined,
  platform: TPlatform | undefined,
  minIos: string,
  minAndroid: string
): boolean {
  if (!appVersion || !platform) return false;
  const clientVersion = semver.valid(semver.coerce(appVersion));
  if (!clientVersion) return false;
  const platformLower = platform.toLowerCase();
  let minVersion: string | null = null;
  if (platformLower === "ios") minVersion = minIos;
  else if (platformLower === "android") minVersion = minAndroid;
  if (!minVersion || !semver.valid(semver.coerce(minVersion))) return false;
  return semver.lt(clientVersion, minVersion);
}

export const initRoutes = async (server: FastifyInstance): Promise<void> => {
  server.get("/init", async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const appVersion = request.headers["x-app-version"] as string | undefined;
    const platform = request.headers["x-platform"] as TPlatform | undefined;

    const config = await appConfigDb.find();
    if (!config) {
      server.log.error("[init] app_config not found");
      await reply.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
        error: "App config unavailable",
      });
      return;
    }

    const forceUpdate = computeForceUpdate(
      appVersion,
      platform,
      config.minIosAppVersion,
      config.minAndroidAppVersion
    );

    const dbVersion = await getDbVersion();

    const response: IInitResponse = {
      apiVersion: API_VERSION,
      appStoreUrl: config.appStoreUrl,
      dbVersion,
      forceUpdate,
      maintenanceMode: config.maintenanceMode,
      minAndroidAppVersion: config.minAndroidAppVersion,
      minIosAppVersion: config.minIosAppVersion,
      playStoreUrl: config.playStoreUrl,
    };

    await reply.send(response);
  });
};
