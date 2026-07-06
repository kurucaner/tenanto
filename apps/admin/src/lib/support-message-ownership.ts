import { type ISupportMessage } from "@/packages/shared";

export interface ISupportMessageViewer {
  isAdmin: boolean;
  userId: string;
}

export function isOwnSupportMessage(
  message: ISupportMessage,
  viewer: ISupportMessageViewer,
  ticketUserId: string
): boolean {
  if (viewer.isAdmin) return message.authorUserId !== ticketUserId;
  return message.authorUserId === viewer.userId;
}

export function getAuthorInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}
