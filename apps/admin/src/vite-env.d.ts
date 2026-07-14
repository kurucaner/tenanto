/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_DD_CLIENT_TOKEN?: string;
  readonly VITE_DD_ENV?: string;
  readonly VITE_DD_RUM_APPLICATION_ID?: string;
  readonly VITE_DD_RUM_PROXY_URL?: string;
  readonly VITE_DD_SITE?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
