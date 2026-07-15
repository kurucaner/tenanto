import { memo, useEffect } from "react";
import { useMatches } from "react-router-dom";

import { syncDocumentTitle } from "@/lib/document-title";

interface IRouteHandle {
  title?: string;
}

export const DocumentTitleSync = memo(function DocumentTitleSync() {
  const matches = useMatches();
  const pageTitle = [...matches]
    .reverse()
    .map((match) => (match.handle as IRouteHandle | undefined)?.title)
    .find((title) => title !== undefined);

  useEffect(() => {
    syncDocumentTitle(pageTitle);
  }, [pageTitle]);

  return null;
});
DocumentTitleSync.displayName = "DocumentTitleSync";
