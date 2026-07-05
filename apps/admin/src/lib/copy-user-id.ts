import { toast } from "sonner";

export async function copyUserIdToClipboard(id: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(id);
    toast.success("ID copied");
  } catch {
    toast.error("Could not copy ID");
  }
}
