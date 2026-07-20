import { memo, useState } from "react";

import { HomeCommunicationsColumn } from "@/components/home/home-communications-column";
import { HomeContinueColumn } from "@/components/home/home-continue-column";
import { HomePropertiesColumn } from "@/components/home/home-properties-column";
import { HomeWorkspaceSearch } from "@/components/home/home-workspace-search";

export const HomeWorkspaceHub = memo(() => {
  const [searchActive, setSearchActive] = useState(false);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 pt-4 sm:pt-8">
      <h1 className="text-center font-display text-2xl font-semibold tracking-tight sm:text-3xl">
        Pick up where you left off.
      </h1>

      <HomeWorkspaceSearch onActiveChange={setSearchActive} />

      {!searchActive ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-4">
          <HomePropertiesColumn />
          <HomeContinueColumn />
          <HomeCommunicationsColumn />
        </div>
      ) : null}
    </div>
  );
});
HomeWorkspaceHub.displayName = "HomeWorkspaceHub";
