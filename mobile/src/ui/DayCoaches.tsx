// Who's coaching one practice day: everyone on for that weekday, the day's lead, and who has
// each group. Tap a row to claim it or hand it to someone; each change saves straight away.

import { useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { dayCoaching } from "@/core/logic/assignments";
import { formatLong, weekdayOf, type ISODate } from "@/core/logic/dates";
import { ALL_TEAM } from "@/core/schema/layout";
import type { TeamData } from "@/core/schema/model";
import { assignCoach, cannotSaveReason, signedInCoach, useAppState } from "@/data/store";
import { saveOrAsk } from "./form";
import { Icon } from "./Icon";
import { Banner, Card, Chip, LinkButton, MAX_WIDTH, Row, T, TierChip } from "./kit";
import { RADIUS, useTheme } from "./theme";

type Picking = { group: string; current: string | null } | null;

export function DayCoaches({ data, date }: { data: TeamData; date: ISODate }) {
  const t = useTheme();
  const s = useAppState();
  const [picking, setPicking] = useState<Picking>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const day = dayCoaching(data, date);
  const me = signedInCoach();
  const blocked = cannotSaveReason(s);
  const weekday = weekdayOf(date);

  /** `expected` = who had the group when the picker opened; a different claim since then is a conflict. */
  const assign = async (group: string, coach: string | null, expected: string | null) => {
    setPicking(null);
    setBusy(group);
    setError(null);
    try { await saveOrAsk((resolve) => assignCoach(date, group, coach, expected, resolve)); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(null); }
  };
  const open = (group: string, current: string | null) => (blocked ? setError(blocked) : setPicking({ group, current }));

  const rows = [
    { group: ALL_TEAM, label: "Lead", coach: day.lead },
    ...day.groups.map((g) => ({ group: g.group, label: g.group, coach: g.coach })),
  ];

  return (
    <Card>
      <T small muted>On {weekday}s</T>
      <Row style={{ marginTop: 6, gap: 6 }}>
        {day.onDuty.length
          ? day.onDuty.map((c) => <Chip key={c.row} label={c.fullName} fg={t.text} bg={t.surface2} />)
          : <T small muted>Nobody is set to coach {weekday}s — set coaches' days under More.</T>}
      </Row>

      <View style={{ marginTop: 12, gap: 2 }}>
        {rows.map((r) => (
          <Pressable key={r.group} accessibilityRole="button" accessibilityLabel={`${r.label}: ${r.coach ?? "open"}. Change`}
            onPress={() => open(r.group, r.coach)}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, paddingVertical: 6, borderTopWidth: 1, borderTopColor: t.line, opacity: pressed ? 0.6 : 1 })}>
            <View style={{ width: 118 }}>
              {r.group === ALL_TEAM ? <T small bold>Lead</T> : <TierChip tier={r.group} tierNames={data.settings.tierNames} />}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              {r.coach
                ? <T bold numberOfLines={1}>{r.coach}</T>
                : <T muted>Open — tap to claim</T>}
            </View>
            {busy === r.group ? <ActivityIndicator color={t.accent} /> : <Icon name="edit" size={18} color={t.muted} />}
          </Pressable>
        ))}
      </View>
      {error && <View style={{ marginHorizontal: -14, marginTop: 8 }}><Banner kind="error">{error}</Banner></View>}

      <CoachPicker picking={picking} data={data} date={date} me={me} onDuty={day.onDuty.map((c) => c.fullName)}
        onPick={(coach) => picking && assign(picking.group, coach, picking.current)} onClose={() => setPicking(null)} />
    </Card>
  );
}

function CoachPicker({ picking, data, date, me, onDuty, onPick, onClose }: {
  picking: Picking; data: TeamData; date: ISODate; me: string | null; onDuty: string[];
  onPick: (coach: string | null) => void; onClose: () => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const weekday = weekdayOf(date);
  const active = data.coaches.filter((c) => c.status === "Active");
  const options = [
    ...onDuty.map((name) => ({ name, sub: `On ${weekday}s` })),
    ...active.filter((c) => !onDuty.includes(c.fullName)).map((c) => ({ name: c.fullName, sub: `Not usually on ${weekday}s` })),
  ];
  if (me) { const i = options.findIndex((o) => o.name === me); if (i > 0) options.unshift(...options.splice(i, 1)); }
  const title = picking?.group === ALL_TEAM ? `Who's leading ${formatLong(date)}?` : `Who has ${picking?.group} on ${formatLong(date)}?`;

  return (
    <Modal visible={!!picking} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "#0006" }} onPress={onClose} accessibilityLabel="Close" />
      <View style={{ maxHeight: "75%", backgroundColor: t.bg, borderTopLeftRadius: RADIUS, borderTopRightRadius: RADIUS, paddingTop: 12, paddingHorizontal: 16, paddingBottom: insets.bottom + 8, width: "100%", maxWidth: MAX_WIDTH, alignSelf: "center" }}>
        <Row style={{ justifyContent: "space-between", flexWrap: "nowrap", marginBottom: 8 }}>
          <T bold style={{ flex: 1 }}>{title}</T>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} onPress={onClose}><Icon name="close" color={t.muted} /></Pressable>
        </Row>
        <FlatList data={options} keyExtractor={(o) => o.name}
          renderItem={({ item }) => {
            const on = item.name === picking?.current;
            return (
              <Pressable accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => onPick(item.name)}
                style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, paddingHorizontal: 12, borderRadius: 10, backgroundColor: pressed || on ? t.surface2 : "transparent" })}>
                <View style={{ flex: 1 }}>
                  <T bold={on}>{item.name === me ? `Me (${item.name})` : item.name}</T>
                  <T small muted>{item.sub}</T>
                </View>
                {on && <Icon name="check" size={20} color={t.accent} />}
              </Pressable>
            );
          }}
          ListFooterComponent={picking?.current ? (
            <View style={{ padding: 12 }}><LinkButton label="Nobody — leave it open" onPress={() => onPick(null)} /></View>
          ) : null} />
      </View>
    </Modal>
  );
}
