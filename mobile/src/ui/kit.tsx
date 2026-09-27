// Small building blocks shared by every screen. Phone-first: one column, big tap targets.

import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { refresh, useAppState } from "@/data/store";
import { Icon, type IconName } from "./Icon";
import { RADIUS, tierColors, useTheme } from "./theme";

export const MAX_WIDTH = 720;

/** A scrolling screen body with pull-to-refresh (when a Sheet is connected). */
export function Screen({ children, refreshable = true }: { children: ReactNode; refreshable?: boolean }) {
  const t = useTheme();
  const s = useAppState();
  const canPull = refreshable && s.source?.kind === "sheet";
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled"
      refreshControl={canPull ? <RefreshControl refreshing={s.loading} onRefresh={refresh} tintColor={t.accent} colors={[t.accent]} /> : undefined}>
      {children}
    </ScrollView>
  );
}

export function T({ children, style, muted, small, bold, numberOfLines }: {
  children: ReactNode; style?: StyleProp<TextStyle>; muted?: boolean; small?: boolean; bold?: boolean; numberOfLines?: number;
}) {
  const t = useTheme();
  return (
    <Text numberOfLines={numberOfLines} style={[{ color: muted ? t.muted : t.text, fontSize: small ? 14 : 16, lineHeight: small ? 20 : 23 }, bold && { fontWeight: "600" }, style]}>
      {children}
    </Text>
  );
}

export function H2({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={{ color: t.text, fontSize: 22, fontWeight: "700", lineHeight: 28 }}>{children}</Text>;
}

export function Card({ children, style, tint }: { children: ReactNode; style?: StyleProp<ViewStyle>; tint?: string }) {
  const t = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }, tint ? { borderLeftWidth: 5, borderLeftColor: tint } : null, style]}>
      {children}
    </View>
  );
}

export function Section({ title, action, children }: { title?: string; action?: ReactNode; children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ marginTop: 22 }}>
      {(title || action) && (
        <View style={styles.sectionHead}>
          {title ? <Text style={{ color: t.muted, fontSize: 13, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" }}>{title}</Text> : <View />}
          {action}
        </View>
      )}
      {children}
    </View>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <View style={[styles.empty, { borderColor: t.line }]}>{typeof children === "string" ? <T muted style={{ textAlign: "center" }}>{children}</T> : children}</View>;
}

/** A label/value pair that renders nothing when the value is blank. */
export function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={{ paddingVertical: 7 }}>
      <T small muted>{label}</T>
      <T>{value}</T>
    </View>
  );
}

export function Chip({ label, fg, bg }: { label: string; fg: string; bg: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontSize: 13, fontWeight: "700" }} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export function TierChip({ tier, tierNames }: { tier: string; tierNames: string[] }) {
  const t = useTheme();
  if (!tier) return null;
  const c = tierColors(t, tier, tierNames);
  return <Chip label={tier} fg={c.fg} bg={c.bg} />;
}

export function MutedChip({ label }: { label: string }) {
  const t = useTheme();
  return <Chip label={label} fg={t.tiers.none.fg} bg={t.tiers.none.bg} />;
}

type ButtonKind = "primary" | "plain" | "danger";

export function Button({ label, onPress, kind = "plain", disabled, busy, icon, style }: {
  label: string; onPress: () => void; kind?: ButtonKind; disabled?: boolean; busy?: boolean; icon?: IconName; style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const bg = kind === "primary" ? t.accent : t.surface;
  const fg = kind === "primary" ? t.accentText : kind === "danger" ? t.danger : t.text;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled || !!busy, busy: !!busy }} disabled={disabled || busy} onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: bg, borderColor: kind === "primary" ? bg : t.line, opacity: disabled ? 0.5 : pressed ? 0.75 : 1 }, style]}>
      {busy ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={20} color={fg} /> : null}
      <Text style={{ color: fg, fontSize: 16, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({ icon, label, onPress, disabled, color }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean; color?: string }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={8} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [styles.iconButton, { opacity: disabled ? 0.4 : pressed ? 0.6 : 1 }]}>
      <Icon name={icon} color={color ?? t.accent} />
    </Pressable>
  );
}

export function LinkButton({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8}>
      <Text style={{ color: t.accent, fontSize: 15, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

export function Banner({ children, kind = "warn", action }: { children: ReactNode; kind?: "warn" | "error"; action?: ReactNode }) {
  const t = useTheme();
  return (
    <View accessibilityRole={kind === "error" ? "alert" : undefined} style={[styles.banner, { backgroundColor: kind === "error" ? t.errorBg : t.warnBg }]}>
      <Text style={{ color: kind === "error" ? t.danger : t.warnText, fontSize: 14, lineHeight: 20 }}>{children}</Text>
      {action}
    </View>
  );
}

export function FilterChips<V extends string>({ options, value, onChange, label }: {
  options: { value: V; label: string; tier?: string }[]; value: V; onChange: (v: V) => void; label: string;
}) {
  const t = useTheme();
  const s = useAppState();
  const tierNames = s.data?.settings.tierNames ?? [];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel={label} style={{ marginBottom: 8 }} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
      {options.map((o) => {
        const on = o.value === value;
        const c = o.tier ? tierColors(t, o.tier, tierNames) : { fg: t.accent, bg: t.surface2 };
        return (
          <Pressable key={o.value} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => onChange(o.value)}
            style={[styles.filterChip, { borderColor: on ? c.fg : t.line, backgroundColor: on ? (o.tier ? c.bg : t.accent) : t.surface }]}>
            <Text style={{ color: on ? (o.tier ? c.fg : t.accentText) : t.text, fontSize: 14, fontWeight: on ? "700" : "500" }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const t = useTheme();
  return (
    <View style={[styles.search, { backgroundColor: t.surface, borderColor: t.line }]}>
      <Icon name="search" size={18} color={t.muted} />
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={t.muted} accessibilityLabel={placeholder}
        autoCorrect={false} clearButtonMode="while-editing" returnKeyType="search" style={{ flex: 1, color: t.text, fontSize: 16, paddingVertical: 10 }} />
    </View>
  );
}

/** A tappable row in a list: title, optional subtitle, something on the right. */
export function ListRow({ title, subtitle, right, onPress, dim }: { title: string; subtitle?: string; right?: ReactNode; onPress?: () => void; dim?: boolean }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole={onPress ? "button" : undefined} onPress={onPress} disabled={!onPress}
      style={({ pressed }) => [styles.listRow, { backgroundColor: pressed ? t.surface2 : t.surface, borderColor: t.line, opacity: dim ? 0.6 : 1 }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T bold numberOfLines={1}>{title}</T>
        {subtitle ? <T small muted numberOfLines={1}>{subtitle}</T> : null}
      </View>
      {right}
    </Pressable>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: { padding: 16, paddingBottom: 40, width: "100%", maxWidth: MAX_WIDTH, alignSelf: "center" },
  card: { borderRadius: RADIUS, borderWidth: StyleSheet.hairlineWidth, padding: 14, marginBottom: 10 },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  empty: { borderWidth: 1, borderStyle: "dashed", borderRadius: RADIUS, padding: 20, alignItems: "center", gap: 12 },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: "flex-start" },
  button: { minHeight: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  banner: { paddingHorizontal: 16, paddingVertical: 10, gap: 6 },
  filterChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, minHeight: 38, justifyContent: "center" },
  search: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, marginBottom: 10 },
  listRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, paddingHorizontal: 14, paddingVertical: 10, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, marginBottom: 6 },
});
