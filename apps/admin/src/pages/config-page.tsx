import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SlidersHorizontal } from "lucide-react";
import { memo, useState } from "react";
import { toast } from "sonner";

import { AdminPageLayout } from "@/components/admin-page-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { adminApi } from "@/lib/api-client";
import { adminQueryKeys } from "@/lib/query-keys";
import type { IAppConfig } from "@/packages/shared";

const ConfigForm = memo(({ config }: Readonly<{ config: IAppConfig }>) => {
  const queryClient = useQueryClient();
  const [minIos, setMinIos] = useState(config.minIosAppVersion);
  const [minAndroid, setMinAndroid] = useState(config.minAndroidAppVersion);
  const [maintenanceMode, setMaintenanceMode] = useState(config.maintenanceMode);
  const [appStoreUrl, setAppStoreUrl] = useState(() => config.appStoreUrl ?? "");
  const [playStoreUrl, setPlayStoreUrl] = useState(() => config.playStoreUrl ?? "");

  const saveMutation = useMutation({
    mutationFn: () =>
      adminApi.patchAppConfig({
        appStoreUrl: appStoreUrl.trim() === "" ? null : appStoreUrl.trim(),
        maintenanceMode,
        minAndroidAppVersion: minAndroid.trim(),
        minIosAppVersion: minIos.trim(),
        playStoreUrl: playStoreUrl.trim() === "" ? null : playStoreUrl.trim(),
      }),
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Save failed");
    },
    onSuccess: (res) => {
      toast.success("Configuration saved");
      queryClient.setQueryData(adminQueryKeys.appConfig(), { config: res.config });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
    },
  });

  return (
    <Card className="border-border/80 bg-card/80 shadow-sm backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="text-muted-foreground size-4" />
          <CardTitle className="text-lg">App configuration</CardTitle>
        </div>
        <CardDescription>
          Minimum app versions, maintenance mode, and store links used by the mobile{" "}
          <code className="text-foreground">/init</code> endpoint.
        </CardDescription>
        <p className="text-muted-foreground text-xs">
          Last updated: {new Date(config.updatedAt).toLocaleString()}
        </p>
      </CardHeader>
      <Separator />
      <CardContent className="space-y-6 pt-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="min-ios">Minimum iOS app version</Label>
            <Input
              id="min-ios"
              autoComplete="off"
              onChange={(e) => setMinIos(e.target.value)}
              placeholder="1.0.0"
              value={minIos}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="min-android">Minimum Android app version</Label>
            <Input
              id="min-android"
              autoComplete="off"
              onChange={(e) => setMinAndroid(e.target.value)}
              placeholder="1.0.0"
              value={minAndroid}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            checked={maintenanceMode}
            id="maintenance"
            onCheckedChange={(v) => setMaintenanceMode(v === true)}
          />
          <Label className="font-normal" htmlFor="maintenance">
            Maintenance mode (clients see maintenance screen)
          </Label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="app-store-url">App Store URL</Label>
            <Input
              id="app-store-url"
              autoComplete="off"
              onChange={(e) => setAppStoreUrl(e.target.value)}
              placeholder="https://apps.apple.com/..."
              type="url"
              value={appStoreUrl}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="play-store-url">Play Store URL</Label>
            <Input
              id="play-store-url"
              autoComplete="off"
              onChange={(e) => setPlayStoreUrl(e.target.value)}
              placeholder="https://play.google.com/..."
              type="url"
              value={playStoreUrl}
            />
          </div>
        </div>

        <Button
          disabled={saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
          type="button"
        >
          {saveMutation.isPending ? "Saving…" : "Save changes"}
        </Button>
      </CardContent>
    </Card>
  );
});
ConfigForm.displayName = "ConfigForm";

const configIntro = {
  description: "Minimum versions, maintenance, and store URLs for mobile clients.",
  eyebrow: "Settings",
  title: "Configuration",
} as const;

const ConfigPageInner = memo(() => {
  const query = useQuery({
    queryFn: () => adminApi.getAppConfig(),
    queryKey: adminQueryKeys.appConfig(),
  });

  if (query.isLoading) {
    return (
      <AdminPageLayout intro={configIntro} maxWidth="3xl">
        <Card className="border-border/80 bg-card/80 shadow-sm backdrop-blur-sm">
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-full max-w-md" />
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-32" />
          </CardContent>
        </Card>
      </AdminPageLayout>
    );
  }

  if (query.isError) {
    return (
      <AdminPageLayout intro={configIntro} maxWidth="3xl">
        <p className="text-destructive text-sm">
          {query.error instanceof Error ? query.error.message : "Failed to load configuration"}
        </p>
      </AdminPageLayout>
    );
  }

  if (!query.data?.config) {
    return null;
  }

  return (
    <AdminPageLayout intro={configIntro}>
      <ConfigForm
        config={query.data.config}
        key={`${query.data.config.id}-${query.data.config.updatedAt}`}
      />
    </AdminPageLayout>
  );
});
ConfigPageInner.displayName = "ConfigPageInner";

export const ConfigPage = ConfigPageInner;
