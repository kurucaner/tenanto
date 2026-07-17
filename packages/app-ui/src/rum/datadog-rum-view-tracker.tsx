import { memo, useEffect } from "react";
import { useLocation } from "react-router-dom";

interface IDatadogRumViewTrackerProps {
  trackView: (name: string) => void;
}

export const DatadogRumViewTracker = memo(function DatadogRumViewTracker({
  trackView,
}: IDatadogRumViewTrackerProps) {
  const location = useLocation();

  useEffect(() => {
    trackView(location.pathname);
  }, [location.pathname, trackView]);

  return null;
});
DatadogRumViewTracker.displayName = "DatadogRumViewTracker";
