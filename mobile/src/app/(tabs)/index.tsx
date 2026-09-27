// Today — the phone replacement for the Sheet's Day View: one practice day's plan as a
// timeline, top to bottom, against the practice time in Settings (e.g. 5:30–8:00 PM).
// Tap a block to edit it; "Rearrange" shows quick controls for changes mid-practice
// (move up/down, ±5 minutes), each saved with one tap.

import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { addStandardOutline, cannotSaveReason, moveBlock, save, useAppState } from "@/data/store";
import type { WorkoutBlock } from "@/core/schema/model";
import { daysBetween, formatLong, nextPracticeDay, stepPracticeDay, todayISO, type ISODate } from "@/core/logic/dates";
import { practiceInfo } from "@/core/logic/rotation";
import { dayTimeline, formatClock, formatDuration, type DayTimeline, type TimedBlock } from "@/core/logic/timeline";
import { DateField } from "@/ui/DateField";
import { Icon, type IconName } from "@/ui/Icon";
import { Banner, Button, Card, Empty, IconButton, LinkButton, Row, Screen, T, TierChip } from "@/ui/kit";
import { tierColors, useTheme } from "@/ui/theme";

function nearestPlannedDay(log: WorkoutBlock[], d: ISODate): ISODate | null {
  let best: ISODate | null = null;
  for (const b of log) {
    if (!best || Math.abs(daysBetween(d, b.date)) < Math.abs(daysBetween(d, best))) best = b.date;
  }
  return best;
}

export default function Today() {
  const t = useTheme();
  const s = useAppState();
  const { d } = useLocalSearchParams<{ d?: string }>();
  const [rearrange, setRearrange] = useState(false);
  const [busyRow, setBusyRow] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const data = s.data;
  if (!data) return null;

  const today = todayISO();
  const date = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : nextPracticeDay(today);
  const show = (next: ISODate) => { setRearrange(false); setError(null); router.setParams({ d: next }); };

  const { settings, coaches, log } = data;
  const info = practiceInfo(settings, coaches, date);
  const dayBlocks = log.filter((b) => b.date === date);
  const timeline = dayTimeline(dayBlocks, settings.practice, settings.tierNames);
  const nearest = dayBlocks.length ? null : nearestPlannedDay(log, date);
  const featured = info.featuredTier ? tierColors(t, info.featuredTier, settings.tierNames) : null;
  const blocked = cannotSaveReason(s);

  /** Runs one quick change, showing a spinner on that block until the Sheet has it. */
  const quick = async (row: number, fn: () => Promise<void>) => {
    setBusyRow(row);
    setError(null);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusyRow(null); }
  };
  const resize = (b: WorkoutBlock, delta: number) => quick(b.row, () => {
    const minutes = Math.max(5, (b.minutes ?? 0) + delta);
    const { row: _row, ...value } = b;
    return save({ table: "log", row: b.row, was: b, value: { ...value, minutes } });
  });
  const move = (b: WorkoutBlock, dir: -1 | 1) => quick(b.row, () => moveBlock(dayBlocks, b.row, dir));

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

      <TimeBudget timeline={timeline} blockCount={dayBlocks.length} />

      {error && <View style={{ marginHorizontal: -16, marginBottom: 10 }}><Banner kind="error">{error}</Banner></View>}
      {rearrange && blocked && <View style={{ marginHorizontal: -16, marginBottom: 10 }}><Banner>{blocked}</Banner></View>}

      {dayBlocks.length === 0 ? (
        <Empty>
          <T muted>Nothing planned for this day yet.</T>
          <Button label={`Start with the standard outline (${settings.practice.warmupMinutes} min warm-up, ${settings.practice.cooldownMinutes} min stretch)`}
            kind="primary" busy={busyRow === -1} disabled={!!blocked || busyRow !== null}
            onPress={() => quick(-1, () => addStandardOutline(date))} />
          {nearest && <LinkButton label={`Or go to the nearest planned day (${formatLong(nearest)})`} onPress={() => show(nearest)} />}
        </Empty>
      ) : (
        <>
          <Row style={{ justifyContent: "space-between", marginVertical: 8 }}>
            <T small muted>{dayBlocks.length} block{dayBlocks.length === 1 ? "" : "s"} · {rearrange ? "use the arrows and ±5" : "tap one to edit"}</T>
            <LinkButton label={rearrange ? "Done" : "Rearrange"} onPress={() => { setRearrange(!rearrange); setError(null); }} />
          </Row>
          {timeline.blocks.map((tb, i) => (
            <View key={tb.block.row}>
              {timeline.open && timeline.openBeforeRow === tb.block.row && <OpenSlot open={timeline.open} date={date} />}
              <BlockCard timed={tb} tierNames={settings.tierNames} rearrange={rearrange}
                busy={busyRow === tb.block.row} disabled={!!blocked || busyRow !== null}
                first={i === 0} last={i === timeline.blocks.length - 1}
                onMove={(dir) => move(tb.block, dir)} onResize={(delta) => resize(tb.block, delta)} />
            </View>
          ))}
        </>
      )}
      <Button label="Add a block" icon="plus" kind={dayBlocks.length ? "primary" : "plain"} style={{ marginTop: 12 }}
        onPress={() => router.push({ pathname: "/edit/block", params: { date } })} />
    </Screen>
  );
}

/** Unplanned time before the closing stretch — tap to fill it. */
function OpenSlot({ open, date }: { open: { start: number; end: number }; date: ISODate }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${open.end - open.start} minutes open from ${formatClock(open.start, true)}. Add a block here.`}
      onPress={() => router.push({ pathname: "/edit/block", params: { date } })}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1.5, borderStyle: "dashed", borderColor: t.line,
        borderRadius: 14, padding: 12, marginBottom: 10, opacity: pressed ? 0.7 : 1 })}>
      <View style={{ width: 52 }}>
        <T bold style={{ fontSize: 17, color: t.muted }}>{formatClock(open.start)}</T>
        <T small muted>{open.end - open.start} min</T>
      </View>
      <View style={{ flex: 1 }}>
        <T muted>Open time until {formatClock(open.end, true)}</T>
        <T small style={{ color: t.accent, fontWeight: "600" }}>+ Add a block here</T>
      </View>
    </Pressable>
  );
}

/** How the planned blocks fit the practice time (e.g. 5:30–8:00 PM). */
function TimeBudget({ timeline: tl, blockCount }: { timeline: DayTimeline; blockCount: number }) {
  const t = useTheme();
  const open = tl.availableMinutes - tl.plannedMinutes;
  const fill = Math.min(1, tl.plannedMinutes / Math.max(1, tl.availableMinutes));
  const status = tl.overBy > 0 ? `Runs ${formatDuration(tl.overBy)} over — ends ${formatClock(tl.end, true)}`
    : open === 0 ? "Fully planned"
    : `${formatDuration(tl.plannedMinutes)} planned · ${formatDuration(open)} open`;
  return (
    <Card>
      <Row style={{ justifyContent: "space-between" }}>
        <Row style={{ gap: 6 }}>
          <Icon name="clock" size={18} color={t.muted} />
          <T small bold>{formatClock(tl.start)}–{formatClock(tl.start + tl.availableMinutes, true)}</T>
          <T small muted>({formatDuration(tl.availableMinutes)})</T>
        </Row>
      </Row>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: t.surface2, marginVertical: 8, overflow: "hidden" }}
        accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: tl.availableMinutes, now: Math.min(tl.plannedMinutes, tl.availableMinutes) }}>
        <View style={{ width: `${fill * 100}%`, height: "100%", backgroundColor: tl.overBy > 0 ? t.danger : t.accent, borderRadius: 4 }} />
      </View>
      <T small style={{ color: tl.overBy > 0 ? t.danger : t.muted }}>{blockCount ? status : "Nothing planned yet"}</T>
      {tl.untimed > 0 && <T small muted>{tl.untimed} block{tl.untimed === 1 ? " has" : "s have"} no length yet — tap to add one.</T>}
    </Card>
  );
}

function BlockCard({ timed: tb, tierNames, rearrange, busy, disabled, first, last, onMove, onResize }: {
  timed: TimedBlock; tierNames: string[]; rearrange: boolean; busy: boolean; disabled: boolean; first: boolean; last: boolean;
  onMove: (dir: -1 | 1) => void; onResize: (delta: number) => void;
}) {
  const t = useTheme();
  const b = tb.block;
  const title = b.libraryItem || b.blockType || b.description || "Block";
  const hasTime = b.minutes !== null;
  const tint = tierColors(t, b.group, tierNames).fg;
  const card = (pressed: boolean) => (
        <Card tint={tint} style={[{ flexDirection: "row", gap: 12, paddingLeft: 12 }, pressed && { opacity: 0.75 }]}>
          <View style={{ width: 52, alignItems: "flex-start" }}>
            <T bold style={{ fontSize: 17 }}>{hasTime ? formatClock(tb.start) : "—"}</T>
            <T small muted>{hasTime ? `${b.minutes} min` : "no time"}</T>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Row style={{ justifyContent: "space-between", flexWrap: "nowrap", alignItems: "flex-start" }}>
              <T bold style={{ flex: 1, fontSize: 17 }}>{title}</T>
              <TierChip tier={b.group} tierNames={tierNames} />
            </Row>
            {b.libraryItem && b.blockType ? <T small muted>{b.blockType}</T> : null}
            {!rearrange && b.description && b.description !== title ? <T style={{ marginTop: 4 }}>{b.description}</T> : null}
            {!rearrange && (b.setsRepsDuration || b.coach) ? (
              <Row style={{ marginTop: 6, gap: 14 }}>
                {b.setsRepsDuration ? <T small bold>{b.setsRepsDuration}</T> : null}
                {b.coach ? <T small muted>Coach: {b.coach}</T> : null}
              </Row>
            ) : null}
            {!rearrange && b.notes ? <T small muted style={{ marginTop: 4, fontStyle: "italic" }}>{b.notes}</T> : null}
            {rearrange && (
              <Row style={{ marginTop: 8, gap: 8 }}>
                {busy ? <ActivityIndicator color={t.accent} /> : null}
                <QuickButton icon="minus" label="5 min shorter" text="5" onPress={() => onResize(-5)} disabled={disabled || (b.minutes ?? 0) <= 5} />
                <QuickButton icon="plus" label="5 min longer" text="5" onPress={() => onResize(5)} disabled={disabled} />
                <View style={{ flex: 1 }} />
                <QuickButton icon="chevronUp" label="Move earlier" onPress={() => onMove(-1)} disabled={disabled || first} />
                <QuickButton icon="chevronDown" label="Move later" onPress={() => onMove(1)} disabled={disabled || last} />
              </Row>
            )}
          </View>
        </Card>
  );
  // While rearranging, the card itself isn't tappable, so its buttons get every tap.
  if (rearrange) return card(false);
  return (
    <Pressable accessibilityRole="button" accessibilityHint="Edit this block"
      onPress={() => router.push({ pathname: "/edit/block", params: { row: String(b.row) } })}>
      {({ pressed }) => card(pressed)}
    </Pressable>
  );
}

function QuickButton({ icon, label, text, onPress, disabled }: { icon: IconName; label: string; text?: string; onPress: () => void; disabled?: boolean }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={disabled} hitSlop={4}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 2, minWidth: 44, minHeight: 40, paddingHorizontal: 8, justifyContent: "center",
        borderRadius: 10, borderWidth: 1, borderColor: t.line, backgroundColor: pressed ? t.surface2 : t.surface, opacity: disabled ? 0.35 : 1 })}>
      <Icon name={icon} size={18} color={t.text} />
      {text ? <T small bold>{text}</T> : null}
    </Pressable>
  );
}
