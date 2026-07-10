import { OTA_CHANNELS } from "@/lib/marketing-content";

export function ChannelPills() {
  return (
    <div className="flex flex-wrap gap-3">
      {OTA_CHANNELS.map((channel) => (
        <span
          className="rounded-full border border-mist/15 bg-mist/4 px-4 py-2 font-display text-mist/70 text-sm"
          key={channel}
        >
          {channel}
        </span>
      ))}
    </div>
  );
}
