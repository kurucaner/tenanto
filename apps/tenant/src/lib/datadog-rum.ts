import { createDatadogRum } from "@/packages/app-ui";

const datadogRum = createDatadogRum({ service: "propertyos-tenant" });

export const {
  clearUser: clearDatadogRumUser,
  init: initDatadogRum,
  isEnabled: isDatadogRumEnabled,
  setUser: setDatadogRumUser,
  trackError: trackDatadogRumError,
  trackView: trackDatadogRumView,
} = datadogRum;
