/** App version from the monorepo root package.json (injected at build time). */
export const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? "0.0.0";
