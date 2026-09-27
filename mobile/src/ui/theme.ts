// Colors for light and dark mode — the same palette as the first web version.
// Tier colors follow the tier's *position* in Settings (1st/2nd/3rd), never its name,
// so renaming a tier in the Sheet keeps its color.

import { useColorScheme } from "react-native";
import { ALL_COACHES, ALL_LEVELS, ALL_TEAM } from "@/core/schema/layout";

const light = {
  bg: "#f6f5f2", surface: "#ffffff", surface2: "#efede8", text: "#1c1d1f", muted: "#6a6b6e", line: "#e1ded7",
  accent: "#2f6f5e", accentText: "#ffffff", danger: "#b3261e", warnBg: "#fff4d6", warnText: "#6b4e00", errorBg: "#fde8e6",
  tiers: {
    t1: { fg: "#c2410c", bg: "#fde9dd" }, t2: { fg: "#1d5fb8", bg: "#e1ecfb" }, t3: { fg: "#2e7d32", bg: "#e2f2e3" },
    all: { fg: "#6b3fa0", bg: "#efe6f8" }, none: { fg: "#5c5d60", bg: "#ebeae6" },
  },
};

const dark: typeof light = {
  bg: "#16181b", surface: "#1f2226", surface2: "#2a2e33", text: "#eceae6", muted: "#a3a5a8", line: "#33373d",
  accent: "#5fb39b", accentText: "#0d1f1a", danger: "#ff8a80", warnBg: "#3a3018", warnText: "#f3d68a", errorBg: "#3d1f1d",
  tiers: {
    t1: { fg: "#fb9a6a", bg: "#3b2418" }, t2: { fg: "#8db8f5", bg: "#1b2b40" }, t3: { fg: "#8fd494", bg: "#1d3320" },
    all: { fg: "#c9a6f0", bg: "#2e2340" }, none: { fg: "#b5b6b8", bg: "#2c2f33" },
  },
};

export type Theme = typeof light;
export type TierColors = Theme["tiers"]["t1"];

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? dark : light;
}

export function tierColors(theme: Theme, tier: string, tierNames: string[]): TierColors {
  if (tier === ALL_TEAM || tier === ALL_LEVELS || tier === ALL_COACHES) return theme.tiers.all;
  const i = tierNames.indexOf(tier);
  return i === 0 ? theme.tiers.t1 : i === 1 ? theme.tiers.t2 : i === 2 ? theme.tiers.t3 : theme.tiers.none;
}

export const RADIUS = 14;
