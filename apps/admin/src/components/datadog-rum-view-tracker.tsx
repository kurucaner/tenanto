import { memo, useEffect } from "react";
import { useLocation } from "react-router-dom";

import { trackDatadogRumView } from "@/lib/datadog-rum";

const DatadogRumViewTrackerInner = memo(() => {
  const location = useLocation();

  useEffect(() => {
    trackDatadogRumView(location.pathname);
  }, [location.pathname]);

  return null;
});
DatadogRumViewTrackerInner.displayName = "DatadogRumViewTracker";

export const DatadogRumViewTracker = DatadogRumViewTrackerInner;
