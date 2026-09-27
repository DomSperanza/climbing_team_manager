// Form controls and the shared add/edit screen frame. Every save goes straight to the Sheet
// and needs a connection, so the Save button is disabled (with the reason shown) when offline.

import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import { Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cannotSaveReason, save, useAppState } from "@/data/store";
import type { Change } from "@/core/writes";
import { Icon } from "./Icon";
import { Banner, Button, MAX_WIDTH, SearchBox, T } from "./kit";
import { RADIUS, useTheme } from "./theme";

// Athletes are minors (HANDOFF.md §1.6): nudge every note toward climbing-only content.
export const NOTES_HINT = "Keep it climbing-specific (e.g. \"fingers sore, take it easy this week\") — no medical or family details.";

export function FieldLabel({ label, hint }: { label: string; hint?: string }) {
  const t = useTheme();
  return (
    <View style={{ marginBottom: 6 }}>
      <Text style={{ color: t.text, fontSize: 15, fontWeight: "600" }}>{label}</Text>
      {hint ? <Text style={{ color: t.muted, fontSize: 13, lineHeight: 18 }}>{hint}</Text> : null}
    </View>
  );
}

export function TextField({ label, value, onChange, hint, placeholder, multiline, keyboardType, autoCapitalize }: {
  label: string; value: string; onChange: (v: string) => void; hint?: string; placeholder?: string; multiline?: boolean;
  keyboardType?: "default" | "email-address" | "phone-pad"; autoCapitalize?: "none" | "sentences" | "words";
}) {
  const t = useTheme();
  return (
    <View style={{ marginBottom: 14 }}>
      <FieldLabel label={label} hint={hint} />
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={t.muted} accessibilityLabel={label}
        multiline={multiline} keyboardType={keyboardType} autoCapitalize={autoCapitalize ?? "sentences"}
        style={{
          color: t.text, fontSize: 16, backgroundColor: t.surface, borderWidth: 1, borderColor: t.line, borderRadius: 12,
          paddingHorizontal: 12, paddingVertical: 11, minHeight: multiline ? 92 : 48, textAlignVertical: multiline ? "top" : "center",
        }} />
    </View>
  );
}

export interface Option { value: string; label?: string; sub?: string }

/** A dropdown: tap to open a sheet of choices (with search when the list is long). */
export function SelectField({ label, value, options, onChange, placeholder = "Choose…", hint, allowBlank }: {
  label: string; value: string; options: Option[]; onChange: (v: string) => void; placeholder?: string; hint?: string; allowBlank?: string;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // A value typed in the Sheet that isn't in the list still shows (and can be kept).
  const all: Option[] = [...(allowBlank ? [{ value: "", label: allowBlank }] : []), ...options];
  if (value && !all.some((o) => o.value === value)) all.push({ value, sub: "Not in the Sheet's list" });
  const q = query.trim().toLowerCase();
  const shown = q ? all.filter((o) => (o.label ?? o.value).toLowerCase().includes(q)) : all;
  const current = all.find((o) => o.value === value);

  return (
    <View style={{ marginBottom: 14 }}>
      <FieldLabel label={label} hint={hint} />
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${current ? current.label ?? current.value : "not set"}`} onPress={() => { setQuery(""); setOpen(true); }}
        style={{ flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface, borderRadius: 12, paddingHorizontal: 12, minHeight: 48 }}>
        <Text style={{ flex: 1, color: value ? t.text : t.muted, fontSize: 16 }} numberOfLines={1}>{value ? current?.label ?? value : allowBlank ?? placeholder}</Text>
        <Icon name="chevronDown" size={20} color={t.muted} />
      </Pressable>
      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: "#0006" }} onPress={() => setOpen(false)} accessibilityLabel="Close" />
        <View style={{ maxHeight: "75%", backgroundColor: t.bg, borderTopLeftRadius: RADIUS, borderTopRightRadius: RADIUS, paddingTop: 12, paddingHorizontal: 16, paddingBottom: insets.bottom + 8, width: "100%", maxWidth: MAX_WIDTH, alignSelf: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <T bold>{label}</T>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} onPress={() => setOpen(false)}><Icon name="close" color={t.muted} /></Pressable>
          </View>
          {all.length > 8 && <SearchBox value={query} onChange={setQuery} placeholder={`Search ${label.toLowerCase()}`} />}
          <FlatList data={shown} keyExtractor={(o) => o.value || "(blank)"} keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const on = item.value === value;
              return (
                <Pressable accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => { onChange(item.value); setOpen(false); }}
                  style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 50, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: pressed || on ? t.surface2 : "transparent" })}>
                  <View style={{ flex: 1 }}>
                    <T bold={on}>{item.label ?? item.value}</T>
                    {item.sub ? <T small muted numberOfLines={1}>{item.sub}</T> : null}
                  </View>
                  {on && <Icon name="check" size={20} color={t.accent} />}
                </Pressable>
              );
            }} />
        </View>
      </Modal>
    </View>
  );
}

const MINUTE_CHOICES = [5, 10, 15, 20, 30, 45, 60, 90];

/** How long a block runs: one tap for the usual lengths, or type any number. */
export function MinutesField({ value, onChange, hint }: { value: number | null; onChange: (m: number | null) => void; hint?: string }) {
  const t = useTheme();
  const custom = value !== null && !MINUTE_CHOICES.includes(value);
  return (
    <View style={{ marginBottom: 14 }}>
      <FieldLabel label="How long (minutes)" hint={hint} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {MINUTE_CHOICES.map((m) => {
          const on = value === m;
          return (
            <Pressable key={m} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`${m} minutes`}
              onPress={() => onChange(on ? null : m)}
              style={{ minWidth: 52, minHeight: 44, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 10,
                borderColor: on ? t.accent : t.line, backgroundColor: on ? t.accent : t.surface }}>
              <Text style={{ color: on ? t.accentText : t.text, fontSize: 16, fontWeight: on ? "700" : "500" }}>{m}</Text>
            </Pressable>
          );
        })}
        <TextInput value={custom ? String(value) : ""} placeholder="Other" placeholderTextColor={t.muted} accessibilityLabel="Other number of minutes"
          keyboardType="number-pad" maxLength={3} onChangeText={(v) => { const n = parseInt(v.replace(/\D/g, ""), 10); onChange(isNaN(n) ? null : n); }}
          style={{ width: 76, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: custom ? t.accent : t.line, backgroundColor: t.surface, color: t.text, fontSize: 16, textAlign: "center" }} />
      </View>
    </View>
  );
}

export function SwitchField({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 48, marginBottom: 8, gap: 12 }}>
      <View style={{ flex: 1 }}><FieldLabel label={label} hint={hint} /></View>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} trackColor={{ true: t.accent, false: t.line }} thumbColor={Platform.OS === "android" ? t.surface : undefined} />
    </View>
  );
}

/** Asks before something destructive; the web has no native alert buttons, so it uses confirm(). */
export function confirmAction(title: string, message: string, confirmLabel: string, onConfirm: () => void) {
  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [{ text: "Cancel", style: "cancel" }, { text: confirmLabel, style: "destructive", onPress: onConfirm }]);
}

/**
 * The frame every add/edit screen shares: the fields, then Save (and Delete for existing
 * rows). `build` turns the form into a Change at the moment Save is pressed.
 */
export function FormScreen({ children, build, onSave, onDelete, deleteLabel = "Delete", note }: {
  children: ReactNode; deleteLabel?: string; note?: string;
  build?: () => Change; // a row to save…
  onSave?: () => Promise<void>; // …or any other save

  /** `leaveTo: "list"` when the screen behind this form shows the deleted record itself. */
  onDelete?: { change: () => Change; title: string; message: string; leaveTo?: "list" };
}) {
  const t = useTheme();
  const s = useAppState();
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const blocked = cannotSaveReason(s);

  const run = async (kind: "save" | "delete", change: Change | null) => {
    setBusy(kind);
    setError(null);
    try {
      await (change ? save(change) : onSave?.());
      if (kind === "delete" && onDelete?.leaveTo === "list" && router.canDismiss()) router.dismissAll();
      else if (router.canGoBack()) router.back();
      else router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, width: "100%", maxWidth: MAX_WIDTH, alignSelf: "center" }} keyboardShouldPersistTaps="handled">
        {s.source?.kind === "demo" && <View style={{ marginBottom: 12, marginHorizontal: -16 }}><Banner>Demo mode — changes are saved on this {Platform.OS === "web" ? "device" : "phone"} only, not to a real Sheet.</Banner></View>}
        {children}
        {note ? <T small muted style={{ marginBottom: 12 }}>{note}</T> : null}
        {error && <View style={{ marginBottom: 12, marginHorizontal: -16 }}><Banner kind="error">{error}</Banner></View>}
        {blocked && <View style={{ marginBottom: 12, marginHorizontal: -16 }}><Banner>{blocked}</Banner></View>}
        <Button label={s.source?.kind === "demo" ? "Save" : "Save to the Sheet"} kind="primary" busy={busy === "save"} disabled={!!blocked || busy !== null}
          onPress={() => { try { run("save", build ? build() : null); } catch (e) { setError(String(e)); } }} />
        {onDelete && (
          <Button label={deleteLabel} kind="danger" style={{ marginTop: 12 }} busy={busy === "delete"} disabled={!!blocked || busy !== null}
            onPress={() => confirmAction(onDelete.title, onDelete.message, deleteLabel, () => run("delete", onDelete.change()))} />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
