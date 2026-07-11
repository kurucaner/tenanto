import { memo } from "react";

import { ColoredPill } from "@/components/income/colored-pill";

interface ReservationChannelBadgeProps {
  channelName: string;
}

export const ReservationChannelBadge = memo(({ channelName }: ReservationChannelBadgeProps) => (
  <ColoredPill className="bg-muted text-foreground">{channelName}</ColoredPill>
));
ReservationChannelBadge.displayName = "ReservationChannelBadge";
