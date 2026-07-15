import { datadogRum } from "@datadog/browser-rum";

import { buildObfuscatedProxyUrl } from "./build-obfuscated-proxy-url";
import type { ICreateDatadogRumOptions, IDatadogRumClient, IDatadogRumUser } from "./types";

const DEFAULT_DD_SITE = "us5.datadoghq.com";

function normalizeProxyUrl(proxyUrl: string): string {
  const trimmed = proxyUrl.replace(/\/$/, "");

  try {
    const url = new URL(trimmed);
    if (url.hostname === "0.0.0.0") {
      url.hostname = "localhost";
      console.warn(
        "[datadog-rum] VITE_DD_RUM_PROXY_URL uses 0.0.0.0, which browsers block. Using http://localhost instead."
      );
      return url.origin;
    }
    return trimmed;
  } catch {
    return trimmed;
  }
}

function getRumConfig() {
  const applicationId = import.meta.env.VITE_DD_RUM_APPLICATION_ID;
  const clientToken = import.meta.env.VITE_DD_CLIENT_TOKEN;
  const proxyUrl = import.meta.env.VITE_DD_RUM_PROXY_URL;

  if (!applicationId || !clientToken || !proxyUrl) {
    return null;
  }

  return {
    applicationId,
    clientToken,
    env: import.meta.env.VITE_DD_ENV ?? import.meta.env.MODE,
    proxyUrl: normalizeProxyUrl(proxyUrl),
    site: import.meta.env.VITE_DD_SITE ?? DEFAULT_DD_SITE,
    version: import.meta.env.VITE_APP_VERSION,
  };
}

function sanitizeUrl(url: unknown): unknown {
  if (typeof url !== "string") {
    return url;
  }

  return url.replace(/([?&](?:token|access_token|refresh_token)=)[^&]+/gi, "$1[redacted]");
}

export function createDatadogRum(options: ICreateDatadogRumOptions): IDatadogRumClient {
  let rumInitialized = false;

  const init = (): void => {
    if (rumInitialized || globalThis.window === undefined) {
      return;
    }

    const config = getRumConfig();
    if (!config) {
      return;
    }

    datadogRum.init({
      applicationId: config.applicationId,
      beforeSend: (event) => {
        const view = event.view as { url?: string } | undefined;
        const resource = event.resource as { url?: string } | undefined;

        if (typeof view?.url === "string") {
          view.url = sanitizeUrl(view.url) as string;
        }
        if (typeof resource?.url === "string") {
          resource.url = sanitizeUrl(resource.url) as string;
        }
        return true;
      },
      clientToken: config.clientToken,
      defaultPrivacyLevel: "mask-user-input",
      env: config.env,
      proxy: (proxyOptions: { parameters: string; path: string; subdomain?: string }) =>
        buildObfuscatedProxyUrl(config.proxyUrl, proxyOptions),
      service: options.service,
      sessionReplaySampleRate: 0,
      sessionSampleRate: 100,
      site: config.site,
      startSessionReplayRecordingManually: false,
      trackLongTasks: true,
      trackResources: true,
      trackUserInteractions: true,
      version: config.version,
    });

    rumInitialized = true;
  };

  const isEnabled = (): boolean => rumInitialized;

  const setUser = (user: IDatadogRumUser): void => {
    if (!rumInitialized) {
      return;
    }

    datadogRum.setUser({
      email: user.email,
      id: user.id,
      name: user.name,
    });
  };

  const clearUser = (): void => {
    if (!rumInitialized) {
      return;
    }

    datadogRum.clearUser();
  };

  const trackView = (name: string): void => {
    if (!rumInitialized) {
      return;
    }

    datadogRum.startView({ name });
  };

  const trackError = (error: unknown, context?: Record<string, unknown>): void => {
    if (!rumInitialized) {
      return;
    }

    if (error instanceof Error) {
      datadogRum.addError(error, context);
      return;
    }

    datadogRum.addError(typeof error === "string" ? error : JSON.stringify(error), context);
  };

  return {
    clearUser,
    init,
    isEnabled,
    setUser,
    trackError,
    trackView,
  };
}
