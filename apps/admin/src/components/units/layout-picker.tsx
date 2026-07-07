import { memo, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const PRESET_LAYOUTS = ["1+0", "1+1", "2+1", "3+1", "4+1", "5+1"] as const;

interface LayoutPickerProps {
  id?: string;
  onChange: (layout: string) => void;
  value: string;
}

export const LayoutPicker = memo(({ id, onChange, value }: LayoutPickerProps) => {
  const isOther =
    value !== "" && !PRESET_LAYOUTS.includes(value as (typeof PRESET_LAYOUTS)[number]);

  const [customRooms, setCustomRooms] = useState(() => {
    if (isOther) return value.split("+")[0] ?? "";
    return "";
  });
  const [customSalon, setCustomSalon] = useState(() => {
    if (isOther) return value.split("+")[1] ?? "";
    return "";
  });
  const [showCustom, setShowCustom] = useState(isOther);

  const handlePreset = (preset: string) => {
    setShowCustom(false);
    setCustomRooms("");
    setCustomSalon("");
    onChange(preset);
  };

  const handleOther = () => {
    setShowCustom(true);
    onChange("");
  };

  const handleCustomRooms = (v: string) => {
    const rooms = v.replace(/\D/g, "");
    setCustomRooms(rooms);
    if (rooms !== "" && customSalon !== "") {
      onChange(`${rooms}+${customSalon}`);
    } else {
      onChange("");
    }
  };

  const handleCustomSalon = (v: string) => {
    const salon = v.replace(/\D/g, "");
    setCustomSalon(salon);
    if (customRooms !== "" && salon !== "") {
      onChange(`${customRooms}+${salon}`);
    } else {
      onChange("");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2" id={id}>
        {PRESET_LAYOUTS.map((preset) => (
          <button
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
              value === preset && !showCustom
                ? "border-foreground bg-foreground text-background"
                : "border-input text-muted-foreground hover:border-foreground hover:text-foreground"
            )}
            key={preset}
            onClick={() => handlePreset(preset)}
            type="button"
          >
            {preset}
          </button>
        ))}
        <button
          className={cn(
            "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
            showCustom
              ? "border-foreground bg-foreground text-background"
              : "border-input text-muted-foreground hover:border-foreground hover:text-foreground"
          )}
          onClick={handleOther}
          type="button"
        >
          Other
        </button>
      </div>

      {showCustom ? (
        <div className="flex items-center gap-2">
          <div className="flex flex-1 flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Rooms</Label>
            <Input
              autoFocus
              inputMode="numeric"
              min={0}
              onChange={(e) => handleCustomRooms(e.target.value)}
              placeholder="e.g. 3"
              type="number"
              value={customRooms}
            />
          </div>
          <span className="mt-5 text-lg font-semibold text-muted-foreground">+</span>
          <div className="flex flex-1 flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Salon</Label>
            <Input
              inputMode="numeric"
              min={0}
              onChange={(e) => handleCustomSalon(e.target.value)}
              placeholder="e.g. 1"
              type="number"
              value={customSalon}
            />
          </div>
          {value === "" ? null : (
            <div className="mt-5 flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm font-medium">
              {value}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
});
LayoutPicker.displayName = "LayoutPicker";
