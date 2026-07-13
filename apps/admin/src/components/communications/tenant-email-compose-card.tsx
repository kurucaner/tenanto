import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, Loader2, Send } from "lucide-react";
import { memo, useCallback, useState } from "react";
import { toast } from "sonner";

import { TenantEmailPreviewDialog } from "@/components/communications/tenant-email-preview-dialog";
import { TenantEmailRichTextEditor } from "@/components/communications/tenant-email-rich-text-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { tenantEmailCampaignsApi } from "@/lib/api-client";
import { hasRichTextContent } from "@/lib/html-plain-text";
import { queryKeys } from "@/lib/query-keys";

interface ITenantEmailComposeCardProps {
  disabled?: boolean;
  onQueued: (campaignId: string) => void;
  propertyId: string;
}

function createTenantEmailIdempotencyKey(): string {
  return crypto.randomUUID();
}

export const TenantEmailComposeCard = memo(
  ({ disabled = false, onQueued, propertyId }: ITenantEmailComposeCardProps) => {
    const queryClient = useQueryClient();
    const [subject, setSubject] = useState("");
    const [htmlBody, setHtmlBody] = useState("<p></p>");
    const [previewOpen, setPreviewOpen] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [idempotencyKey, setIdempotencyKey] = useState(createTenantEmailIdempotencyKey);

    const resetComposeSession = useCallback(() => {
      setSubject("");
      setHtmlBody("<p></p>");
      setSubmitted(false);
      setIdempotencyKey(createTenantEmailIdempotencyKey());
    }, []);

    const createMutation = useMutation({
      mutationFn: (input: { htmlBody: string; idempotencyKey: string; subject: string }) =>
        tenantEmailCampaignsApi.create(
          propertyId,
          { htmlBody: input.htmlBody, subject: input.subject },
          input.idempotencyKey
        ),
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : "Failed to queue notification");
      },
      onSuccess: (response) => {
        setSubmitted(true);
        onQueued(response.campaignId);
        toast.success(`Notification queued for ${response.recipientCount} tenants`);
        void queryClient.invalidateQueries({
          queryKey: queryKeys.propertyTenantEmailCampaigns(propertyId),
        });
        void queryClient.prefetchQuery({
          queryFn: () => tenantEmailCampaignsApi.get(propertyId, response.campaignId),
          queryKey: queryKeys.propertyTenantEmailCampaign(propertyId, response.campaignId),
        });
      },
    });

    const handleSend = useCallback(() => {
      const trimmedSubject = subject.trim();
      if (trimmedSubject.length === 0) {
        toast.error("Subject is required");
        return;
      }
      if (!hasRichTextContent(htmlBody)) {
        toast.error("Message body is required");
        return;
      }

      createMutation.mutate({ htmlBody, idempotencyKey, subject: trimmedSubject });
    }, [createMutation, htmlBody, idempotencyKey, subject]);

    const isBusy = disabled || createMutation.isPending;
    const canSend = !isBusy && !submitted;

    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Compose notification</CardTitle>
            <CardDescription>
              Send an email to primary and secondary tenants on active leases.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tenant-email-subject">Subject</Label>
              <Input
                disabled={isBusy || submitted}
                id="tenant-email-subject"
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Rent reminder, building update, etc."
                value={subject}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tenant-email-body">Message</Label>
              <TenantEmailRichTextEditor
                disabled={isBusy || submitted}
                onChange={setHtmlBody}
                value={htmlBody}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                disabled={isBusy || submitted}
                onClick={() => setPreviewOpen(true)}
                type="button"
                variant="outline"
              >
                <Eye />
                Preview recipients
              </Button>
              <Button disabled={!canSend} onClick={handleSend} type="button">
                {createMutation.isPending ? <Loader2 className="animate-spin" /> : <Send />}
                Send notification
              </Button>
              {submitted ? (
                <>
                  <p className="text-muted-foreground text-sm">
                    Notification queued. Track progress below.
                  </p>
                  <Button onClick={resetComposeSession} type="button" variant="outline">
                    Compose another
                  </Button>
                </>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <TenantEmailPreviewDialog
          onOpenChange={setPreviewOpen}
          open={previewOpen}
          propertyId={propertyId}
        />
      </>
    );
  }
);
TenantEmailComposeCard.displayName = "TenantEmailComposeCard";
