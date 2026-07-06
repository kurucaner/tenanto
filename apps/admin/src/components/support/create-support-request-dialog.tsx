import { useMutation, useQueryClient } from "@tanstack/react-query";
import { memo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import {
  CREATE_CATEGORY_OPTIONS,
  supportSelectClass,
  supportTextareaClass,
} from "@/components/support/support-constants";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supportApi } from "@/lib/api-client";
import { type SupportCategory } from "@/packages/shared";

export const CreateSupportRequestDialog = memo(
  ({
    onOpenChange,
    open,
  }: Readonly<{
    onOpenChange: (open: boolean) => void;
    open: boolean;
  }>) => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [category, setCategory] = useState<SupportCategory>("bug");
    const [message, setMessage] = useState("");

    const mutation = useMutation({
      mutationFn: () =>
        supportApi.create({
          category,
          message: message.trim(),
        }),
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Could not submit request");
      },
      onSuccess: (data) => {
        toast.success("Support request submitted");
        queryClient.invalidateQueries({ queryKey: ["support", "list"] });
        onOpenChange(false);
        setCategory("bug");
        setMessage("");
        navigate(`/support-requests/${encodeURIComponent(data.id)}`);
      },
    });

    const handleSubmit = (e: { preventDefault(): void }) => {
      e.preventDefault();
      if (message.trim().length === 0) {
        toast.error("Message is required");
        return;
      }
      mutation.mutate();
    };

    return (
      <Dialog onOpenChange={onOpenChange} open={open}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>New support request</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-4 px-6 py-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="create-support-category">Category</Label>
                <select
                  className={supportSelectClass}
                  id="create-support-category"
                  onChange={(e) => setCategory(e.target.value as SupportCategory)}
                  value={category}
                >
                  {CREATE_CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="create-support-message">Message</Label>
                <textarea
                  className={supportTextareaClass}
                  id="create-support-message"
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe the issue or request…"
                  required
                  value={message}
                />
              </div>
            </div>
            <DialogFooter>
              <Button disabled={mutation.isPending} type="submit">
                {mutation.isPending ? "Submitting…" : "Submit request"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }
);
CreateSupportRequestDialog.displayName = "CreateSupportRequestDialog";
