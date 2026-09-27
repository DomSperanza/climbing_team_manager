// One practice in an athlete's history: the date, their group that day, what they did (their
// group's blocks plus All Team ones, in time order) and any notes. Tap to change the group,
// add a note, or mark them as not there.

import { router } from "expo-router";
import { Pressable, View } from "react-native";
import type { DayRecord } from "@/core/logic/attendance";
import { formatLong } from "@/core/logic/dates";
import { formatClock } from "@/core/logic/timeline";
import type { Athlete } from "@/core/schema/model";
import { Card, MutedChip, Row, T, TierChip } from "./kit";
import { tierColors, useTheme } from "./theme";

export function AthleteDay({ record, athlete, tierNames }: { record: DayRecord; athlete: Athlete; tierNames: string[] }) {
  const t = useTheme();
  const { entry, blocks } = record;
  const moved = entry.here && entry.group !== athlete.tier;
  return (
    <Pressable accessibilityRole="button" accessibilityHint="Change group, add a note, or mark as not there"
      onPress={() => router.push({ pathname: "/edit/attendance", params: { date: entry.date, athlete: athlete.fullName } })}>
      {({ pressed }) => (
        <Card tint={entry.here ? tierColors(t, entry.group, tierNames).fg : t.line} style={[pressed && { opacity: 0.75 }, !entry.here && { opacity: 0.7 }]}>
          <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
            <T bold style={{ flex: 1 }}>{formatLong(entry.date)}, {entry.date.slice(0, 4)}</T>
            {entry.here ? <TierChip tier={entry.group || "—"} tierNames={tierNames} /> : <MutedChip label="Not there" />}
          </Row>
          {moved && <T small muted>Moved from {athlete.tier || "no group"} for the day</T>}
          {entry.here && (blocks.length ? (
            <View style={{ marginTop: 6, gap: 2 }}>
              {blocks.map(({ block: b, start }) => (
                <Row key={b.row} style={{ flexWrap: "nowrap", gap: 8 }}>
                  <T small muted style={{ width: 40 }}>{b.minutes !== null ? formatClock(start) : ""}</T>
                  <T small style={{ flex: 1 }} numberOfLines={1}>{b.libraryItem || b.blockType || b.description || "Block"}</T>
                  {b.minutes !== null && <T small muted>{b.minutes} min</T>}
                </Row>
              ))}
            </View>
          ) : <T small muted style={{ marginTop: 4 }}>Nothing planned for {entry.group || "this group"} that day.</T>)}
          {entry.notes ? <T small style={{ marginTop: 6, fontStyle: "italic" }}>“{entry.notes}”</T> : null}
        </Card>
      )}
    </Pressable>
  );
}
