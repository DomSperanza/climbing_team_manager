// Who was there on one practice day. Everyone saved for the day is listed under their group
// for that day; flip the switch to mark someone as not there, or tap them to change their
// group for the day or add a brief note. Each change saves straight away.

import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, Switch, View } from "react-native";
import { attendanceOn, unrecorded } from "@/core/logic/attendance";
import { formatLong } from "@/core/logic/dates";
import type { Athlete, AttendanceEntry } from "@/core/schema/model";
import { cannotSaveReason, saveWorkoutDay, setAthleteDay, useAppState } from "@/data/store";
import { saveOrAsk } from "@/ui/form";
import { Banner, Button, Empty, Row, Screen, Section, T, TierChip } from "@/ui/kit";
import { useTheme } from "@/ui/theme";

export default function Attendance() {
  const t = useTheme();
  const s = useAppState();
  const { date } = useLocalSearchParams<{ date: string }>();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const data = s.data;
  if (!data || !date) return null;
  const blocked = cannotSaveReason(s);

  const byName = new Map(data.athletes.map((a) => [a.fullName.toLowerCase(), a]));
  const records = [...attendanceOn(data, date).values()].sort((a, b) => a.athlete.localeCompare(b.athlete));
  const here = records.filter((r) => r.here);
  const away = records.filter((r) => !r.here);
  const missing = unrecorded(data, date);
  const groups = [...data.settings.tierNames.filter(Boolean), ...new Set(here.map((r) => r.group).filter((g) => g && !data.settings.tierNames.includes(g)))];

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(null); }
  };
  const toggle = (r: AttendanceEntry) => run(r.athlete, () => saveOrAsk((resolve) =>
    setAthleteDay(date, r.athlete, { group: r.group, here: !r.here, notes: r.notes }, { group: r.group, here: r.here, notes: r.notes }, resolve)));
  const add = (a: Athlete) => run(a.fullName, () => saveOrAsk((resolve) =>
    setAthleteDay(date, a.fullName, { group: a.tier, here: true, notes: "" }, null, resolve)));

  const row = (r: AttendanceEntry) => {
    const a = byName.get(r.athlete.toLowerCase());
    const sub = [r.here && a && r.group !== a.tier ? `usually ${a.tier || "no group"}` : "", r.notes ? `“${r.notes}”` : ""].filter(Boolean).join(" · ");
    // The name and the switch are separate targets, so flipping the switch never opens the editor.
    return (
      <View key={r.athlete} style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 56, paddingRight: 14,
        borderWidth: 1, borderColor: t.line, borderRadius: 12, marginBottom: 6, backgroundColor: t.surface, opacity: r.here ? 1 : 0.65 }}>
        <Pressable accessibilityRole="button" accessibilityHint="Change group or add a note"
          onPress={() => router.push({ pathname: "/edit/attendance", params: { date, athlete: r.athlete } })}
          style={({ pressed }) => ({ flex: 1, minWidth: 0, alignSelf: "stretch", justifyContent: "center", paddingLeft: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: pressed ? t.surface2 : "transparent" })}>
          <T bold numberOfLines={1}>{r.athlete}</T>
          {sub ? <T small muted numberOfLines={1}>{sub}</T> : null}
        </Pressable>
        {busy === r.athlete ? <ActivityIndicator color={t.accent} /> : (
          <Switch value={r.here} onValueChange={() => toggle(r)} disabled={!!blocked || busy !== null}
            accessibilityLabel={`${r.athlete} was there`} trackColor={{ true: t.accent, false: t.line }} />
        )}
      </View>
    );
  };

  return (
    <Screen refreshable={false}>
      <Stack.Screen options={{ title: "Who was there" }} />
      <T muted>{formatLong(date)}, {date.slice(0, 4)} · {here.length} there{away.length ? `, ${away.length} not` : ""}</T>
      <T small muted style={{ marginTop: 4 }}>Switch someone off if they weren't there. Tap a name to change their group for the day or add a note.</T>
      {error && <View style={{ marginHorizontal: -16, marginTop: 10 }}><Banner kind="error">{error}</Banner></View>}
      {blocked && <View style={{ marginHorizontal: -16, marginTop: 10 }}><Banner>{blocked}</Banner></View>}

      {records.length === 0 && missing.length > 0 && (
        <View style={{ marginTop: 16 }}>
          <Empty>
            <T muted>This day hasn't been saved yet.</T>
            <Button label={`Save workout for ${missing.length} athletes`} kind="primary" busy={busy === "*"} disabled={!!blocked || busy !== null}
              onPress={() => run("*", () => saveWorkoutDay(date))} />
          </Empty>
        </View>
      )}

      {groups.map((g) => {
        const list = here.filter((r) => r.group === g);
        return list.length ? (
          <Section key={g} title={`${g} (${list.length})`}>{list.map(row)}</Section>
        ) : null;
      })}
      {here.some((r) => !r.group) && <Section title="No group">{here.filter((r) => !r.group).map(row)}</Section>}
      {away.length > 0 && <Section title={`Not there (${away.length})`}>{away.map(row)}</Section>}
      {records.length > 0 && missing.length > 0 && (
        <Section title={`Not recorded yet (${missing.length})`}>
          {missing.map((a) => (
            <Row key={a.row} style={{ justifyContent: "space-between", flexWrap: "nowrap", minHeight: 52, paddingHorizontal: 14, borderWidth: 1, borderStyle: "dashed", borderColor: t.line, borderRadius: 12, marginBottom: 6 }}>
              <View style={{ flex: 1 }}><T>{a.fullName}</T><TierChip tier={a.tier} tierNames={data.settings.tierNames} /></View>
              <Button label="Add" icon="plus" busy={busy === a.fullName} disabled={!!blocked || busy !== null} onPress={() => add(a)} style={{ minHeight: 40 }} />
            </Row>
          ))}
        </Section>
      )}
    </Screen>
  );
}
