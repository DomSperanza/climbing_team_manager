// Line icons (same drawings as the first web version), tinted with any color.

import type { ColorValue } from "react-native";
import Svg, { Path } from "react-native-svg";

const PATHS = {
  today: "M7 3v2M17 3v2M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm4 8h2v2H9z",
  schedule: "M4 6h16M4 12h16M4 18h10",
  athletes: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.5a3.5 3.5 0 0 1 0 6.5M21 20c0-2.6-1.6-4.8-4-5.6",
  library: "M5 4h4v16H5zM10 4h4v16h-4zM15.5 4.5l3.8-1 3.2 15.6-3.8 1z",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  refresh: "M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6",
  prev: "M15 5l-7 7 7 7",
  next: "M9 5l7 7-7 7",
  plus: "M12 5v14M5 12h14",
  edit: "M4 20h4L19 9l-4-4L4 16v4ZM14 6l4 4",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z",
  check: "M5 12l5 5L20 7",
  chevronDown: "M6 9l6 6 6-6",
  close: "M6 6l12 12M18 6L6 18",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color: ColorValue }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={name === "more" ? 3.2 : 1.9}
      strokeLinecap="round" strokeLinejoin="round">
      <Path d={PATHS[name]} />
    </Svg>
  );
}
