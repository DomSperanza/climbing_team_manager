// Date picker for Android (the system calendar dialog) and iOS (an inline calendar in a sheet).
// The web version is DateField.web.tsx.

import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";
import { formatLong, todayISO, type ISODate } from "@/core/logic/dates";
import { FieldLabel } from "./form";
import { Icon } from "./Icon";
import { Button } from "./kit";
import { RADIUS, useTheme } from "./theme";

const toDate = (d: ISODate) => { const [y, m, day] = d.split("-").map(Number); return new Date(y, m - 1, day); };

/** `compact`: just the tappable date, no label (for the Today screen's day switcher). */
export function DateField({ label, value, onChange, compact }: { label: string; value: ISODate | null; onChange: (d: ISODate) => void; compact?: boolean }) {
  const t = useTheme();
  const [iosOpen, setIosOpen] = useState(false);
  const current = toDate(value ?? todayISO());

  const open = () => {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({ value: current, mode: "date", onValueChange: (_e, d) => onChange(todayISO(d)) });
    } else {
      setIosOpen(true);
    }
  };

  return (
    <View style={compact ? { flex: 1 } : { marginBottom: 14 }}>
      {!compact && <FieldLabel label={label} />}
      {compact ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value ? formatLong(value) : "not set"}`} onPress={open} style={{ minHeight: 44, justifyContent: "center" }}>
          <Text style={{ color: t.text, fontSize: 18, fontWeight: "700", textAlign: "center" }}>{value ? formatLong(value) : "Pick a date"}</Text>
        </Pressable>
      ) : (
        <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value ? formatLong(value) : "not set"}`} onPress={open}
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: t.line, backgroundColor: t.surface, borderRadius: 12, paddingHorizontal: 12, minHeight: 48 }}>
          <Text style={{ color: value ? t.text : t.muted, fontSize: 16 }}>{value ? `${formatLong(value)}, ${value.slice(0, 4)}` : "Pick a date"}</Text>
          <Icon name="today" size={20} color={t.muted} />
        </Pressable>
      )}
      {Platform.OS === "ios" && (
        <Modal visible={iosOpen} transparent animationType="slide" onRequestClose={() => setIosOpen(false)}>
          <Pressable style={{ flex: 1, backgroundColor: "#0006" }} onPress={() => setIosOpen(false)} />
          <View style={{ backgroundColor: t.surface, padding: 16, paddingBottom: 34, borderTopLeftRadius: RADIUS, borderTopRightRadius: RADIUS }}>
            <DateTimePicker value={current} mode="date" display="inline" accentColor={t.accent}
              onValueChange={(_e, d) => onChange(todayISO(d))} />
            <Button label="Done" kind="primary" onPress={() => setIosOpen(false)} />
          </View>
        </Modal>
      )}
    </View>
  );
}
