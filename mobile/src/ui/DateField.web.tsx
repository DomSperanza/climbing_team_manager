// Date picker for the web version: the browser's own <input type="date">.

import { createElement, useRef } from "react";
import { Pressable, Text, View } from "react-native";
import { formatLong, type ISODate } from "@/core/logic/dates";
import { FieldLabel } from "./form";
import { useTheme } from "./theme";

const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

/** `compact`: just the tappable date, no label (for the Today screen's day switcher). */
export function DateField({ label, value, onChange, compact }: { label: string; value: ISODate | null; onChange: (d: ISODate) => void; compact?: boolean }) {
  const t = useTheme();
  const input = useRef<HTMLInputElement | null>(null);
  const change = (e: { target: { value: string } }) => { if (e.target.value) onChange(e.target.value); };

  if (compact) {
    // Show the date the same way the phone apps do; tapping opens the browser's date picker.
    const open = () => { const el = input.current; if (!el) return; try { el.showPicker(); } catch { el.focus(); } };
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value ? formatLong(value) : "not set"}`} onPress={open}
        style={{ flex: 1, minHeight: 44, justifyContent: "center" }}>
        <Text style={{ color: t.text, fontSize: 18, fontWeight: "700", textAlign: "center" }}>{value ? formatLong(value) : "Pick a date"}</Text>
        {createElement("input", {
          ref: input, type: "date", value: value ?? "", onChange: change, tabIndex: -1, "aria-hidden": true,
          style: { position: "absolute", left: "50%", bottom: 0, width: 1, height: 1, opacity: 0, border: 0, padding: 0 },
        })}
      </Pressable>
    );
  }

  return (
    <View style={{ marginBottom: 14 }}>
      <FieldLabel label={label} />
      {createElement("input", {
        type: "date",
        value: value ?? "",
        "aria-label": label,
        onChange: change,
        style: {
          fontFamily: FONT, fontSize: 16, color: t.text, background: t.surface, border: `1px solid ${t.line}`,
          borderRadius: 12, padding: "0 12px", minHeight: 48, colorScheme: "light dark",
        },
      })}
    </View>
  );
}
