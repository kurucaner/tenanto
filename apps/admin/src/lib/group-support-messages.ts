import { type ISupportMessage } from "@/packages/shared";

export interface ISupportMessageDayGroup {
  dateKey: string;
  label: string;
  messages: ISupportMessage[];
}

function toDateKey(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDayLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year!, month! - 1, day!);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const todayKey = toDateKey(today.toISOString());
  const yesterdayKey = toDateKey(yesterday.toISOString());

  if (dateKey === todayKey) return "Today";
  if (dateKey === yesterdayKey) return "Yesterday";

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

export function groupSupportMessagesByDay(messages: ISupportMessage[]): ISupportMessageDayGroup[] {
  const groups: ISupportMessageDayGroup[] = [];

  for (const message of messages) {
    const dateKey = toDateKey(message.createdAt);
    const last = groups.at(-1);

    if (last?.dateKey === dateKey) {
      last.messages.push(message);
      continue;
    }

    groups.push({
      dateKey,
      label: formatDayLabel(dateKey),
      messages: [message],
    });
  }

  return groups;
}
