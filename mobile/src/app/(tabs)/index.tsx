// Today — the phone replacement for the Sheet's Day View: one practice day's plan, top to
// bottom. Tap a block to edit it; "Add a block" plans something new for that day.

import { router, useLocalSearchParams } from "expo-router";
import { Pressable, View } from "react-native";
import { useAppState } from "@/data/store";
import type { WorkoutBlock } from "@/core/schema/model";
import { daysBetween, formatLong, nextPracticeDay, stepPracticeDay, todayISO, type ISODate } from "@/core/logic/dates";
import { practiceInfo } from "@/core/logic/rotation";
import { DateField } from "@/ui/DateField";
import { Button, Card, Empty, IconButton, LinkButton, Row, Screen, T, TierChip } from "@/ui/kit";
import { tierColors, useTheme } from "@/ui/theme";

function nearestPlannedDay(log: WorkoutBlock[], d: ISODate): ISODate | null {
  let best: ISODate | null = null;
  for (const b of log) {
    if (!best || Math.abs(daysBetween(d, b.date)) < Math.abs(daysBetween(d, best))) best = b.date;
  }
  return best;
}

/** Blocks for the day, grouped by group in the order each group first appears in the log. */
function groupBlocks(blocks: WorkoutBlock[]): [string, WorkoutBlock[]][] {
  const groups = new Map<string, WorkoutBlock[]>();
  for (const b of blocks) {
    const g = b.group || "Unassigned";
    groups.set(g, [...(groups.get(g) ?? []), b]);
  }
  return [...groups];
}

export default function Today() {
  const t = useTheme();
  const { data } = useAppState();
  const { d } = useLocalSearchParams<{ d?: string }>();
  if (!data) return null;

  const today = todayISO();
  const date = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : nextPracticeDay(today);
  const show = (next: ISODate) => router.setParams({ d: next });

  const { settings, coaches, log } = data;
  const info = practiceInfo(settings, coaches, date);
  const blocks = log.filter((b) => b.date === date);
  const groups = groupBlocks(blocks);
  const nearest = blocks.length ? null : nearestPlannedDay(log, date);
  const featured = info.featuredTier ? tierColors(t, info.featuredTier, settings.tierNames) : null;

  return (
    <Screen>
      <Row style={{ flexWrap: "nowrap", gap: 4 }}>
        <IconButton icon="prev" label="Previous practice" onPress={() => show(stepPracticeDay(date, -1))} />
        <DateField compact label="Practice date" value={date} onChange={show} />
        <IconButton icon="next" label="Next practice" onPress={() => show(stepPracticeDay(date, 1))} />
      </Row>
      {date !== nextPracticeDay(today) && (
        <View style={{ alignItems: "center", marginBottom: 8 }}><LinkButton label="Jump to the next practice" onPress={() => show(nextPracticeDay(today))} /></View>
      )}

      <Card tint={featured?.fg} style={featured ? { backgroundColor: featured.bg, borderColor: featured.bg } : undefined}>
        {info.week === null ? (
          <T>Before the season starts{settings.seasonStartDate ? ` (${formatLong(settings.seasonStartDate)})` : ""}.</T>
        ) : (
          <View style={{ gap: 6 }}>
            <Row style={{ justifyContent: "space-between" }}>
              <T small muted>{info.day === "Thursday" ? "Lead coach" : "Coach on duty"}</T>
              <T bold>{info.lead ?? `— add a ${info.day} coach —`}</T>
            </Row>
            {info.featuredTier && (
              <Row style={{ justifyContent: "space-between" }}>
                <T small muted>Featured tier</T>
                <TierChip tier={info.featuredTier} tierNames={settings.tierNames} />
              </Row>
            )}
            <T small muted>Week {info.week}{info.day === "Thursday" ? ` · cycle week ${((info.week - 1) % 4) + 1} of 4` : ""}</T>
          </View>
        )}
      </Card>

      {blocks.length === 0 ? (
        <Empty>
          <T muted>Nothing planned for this day yet.</T>
          {nearest && <Button label={`Go to the nearest planned day (${formatLong(nearest)})`} onPress={() => show(nearest)} />}
        </Empty>
      ) : (
        <>
          <T small muted style={{ marginVertical: 8 }}>{blocks.length} block{blocks.length === 1 ? "" : "s"} planned · tap one to edit</T>
          {groups.map(([group, items]) => (
            <View key={group} style={{ marginBottom: 6 }}>
              {groups.length > 1 && <View style={{ marginVertical: 6 }}><TierChip tier={group} tierNames={settings.tierNames} /></View>}
              {items.map((b) => <BlockCard key={b.row} block={b} tierNames={settings.tierNames} showTier={groups.length === 1} />)}
            </View>
          ))}
        </>
      )}
      <Button label="Add a block" icon="plus" kind="primary" style={{ marginTop: 12 }}
        onPress={() => router.push({ pathname: "/edit/block", params: { date } })} />
    </Screen>
  );
}

function BlockCard({ block: b, tierNames, showTier }: { block: WorkoutBlock; tierNames: string[]; showTier: boolean }) {
  const t = useTheme();
  const title = b.libraryItem || b.blockType || "Block";
  return (
    <Pressable accessibilityRole="button" accessibilityHint="Edit this block" onPress={() => router.push({ pathname: "/edit/block", params: { row: String(b.row) } })}>
      {({ pressed }) => (
        <Card tint={tierColors(t, b.group, tierNames).fg} style={pressed ? { opacity: 0.75 } : undefined}>
          <Row style={{ justifyContent: "space-between", flexWrap: "nowrap", alignItems: "flex-start" }}>
            <T bold style={{ flex: 1, fontSize: 17 }}>{title}</T>
            {showTier && <TierChip tier={b.group} tierNames={tierNames} />}
          </Row>
          {b.libraryItem && b.blockType ? <T small muted>{b.blockType}</T> : null}
          {b.description ? <T style={{ marginTop: 6 }}>{b.description}</T> : null}
          {(b.setsRepsDuration || b.coach) ? (
            <Row style={{ marginTop: 8, gap: 14 }}>
              {b.setsRepsDuration ? <T small bold>{b.setsRepsDuration}</T> : null}
              {b.coach ? <T small muted>Coach: {b.coach}</T> : null}
            </Row>
          ) : null}
          {b.notes ? <T small muted style={{ marginTop: 6, fontStyle: "italic" }}>{b.notes}</T> : null}
        </Card>
      )}
    </Pressable>
  );
}
