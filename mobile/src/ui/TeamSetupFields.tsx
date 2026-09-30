// The team's groups, practice days and practice time — shared by "Create a new team Sheet"
// and More → Team settings. Everything is taps (no typing except group names), so it's quick
// on a phone.

import { Pressable, Text, TextInput, View } from "react-native";
import { shortDay, WEEK, type Weekday } from "@/core/logic/dates";
import { formatClock, formatDuration } from "@/core/logic/timeline";
import { MAX_GROUPS } from "@/core/schema/layout";
import type { Athlete } from "@/core/schema/model";
import type { TeamSetup } from "@/core/teamSettings";
import { notify } from "./form";
import { Icon } from "./Icon";
import { Button, IconButton, Section, T } from "./kit";
import { useTheme } from "./theme";

const norm = (s: string) => s.trim().toLowerCase();

export function TeamSetupFields({ value: v, onChange, athletes }: {
  value: TeamSetup; onChange: (v: TeamSetup) => void;
  athletes?: Athlete[]; // when editing a team that has some: shows who's in each group
}) {
  const t = useTheme();
  const set = (patch: Partial<TeamSetup>) => onChange({ ...v, ...patch });
  const setGroups = (groups: TeamSetup["groups"]) => set({ groups });
  const activeIn = (name: string | null) =>
    name === null ? 0 : (athletes ?? []).filter((a) => a.status === "Active" && norm(a.tier) === norm(name)).length;

  const move = (i: number, dir: -1 | 1) => {
    const next = [...v.groups];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    setGroups(next);
  };
  const remove = (i: number) => {
    const g = v.groups[i];
    const n = activeIn(g.was);
    if (n) return notify(`${n} athlete${n === 1 ? " is" : "s are"} in ${g.was}`, "Move them to another group (or mark them inactive) first, then remove the group.");
    setGroups(v.groups.filter((_, k) => k !== i));
  };
  const toggleDay = (d: Weekday) =>
    set({ practiceDays: v.practiceDays.includes(d) ? v.practiceDays.filter((x) => x !== d) : WEEK.filter((x) => x === d || v.practiceDays.includes(x)) });

  const length = v.end - v.start;
  const middle = length - v.warmupMinutes - v.cooldownMinutes;

  return (
    <>
      <Section title="Groups">
        <T small muted style={{ marginBottom: 10 }}>
          The groups athletes are split into, top to bottom. Each gets its own color, in this order. A team with one group works too.
        </T>
        {v.groups.map((g, i) => {
          const c = t.tiers.list[i] ?? t.tiers.none;
          const n = activeIn(g.was);
          return (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 8 }}>
              <View style={{ width: 6, alignSelf: "stretch", borderRadius: 3, backgroundColor: c.fg }} />
              <View style={{ flex: 1, marginLeft: 6 }}>
                <TextInput value={g.name} onChangeText={(name) => setGroups(v.groups.map((x, k) => (k === i ? { ...x, name } : x)))}
                  placeholder="Group name" placeholderTextColor={t.muted} accessibilityLabel={`Group ${i + 1} name`} autoCapitalize="words"
                  style={{ color: t.text, fontSize: 16, backgroundColor: t.surface, borderWidth: 1, borderColor: t.line, borderRadius: 12, paddingHorizontal: 12, minHeight: 48 }} />
                {g.was !== null && g.name.trim() !== g.was ? (
                  <T small muted>Was “{g.was}” — renamed everywhere it's used when you save</T>
                ) : athletes && g.was !== null ? (
                  <T small muted>{n} active athlete{n === 1 ? "" : "s"}</T>
                ) : null}
              </View>
              <IconButton icon="chevronUp" label={`Move ${g.name || "group"} up`} disabled={i === 0} onPress={() => move(i, -1)} />
              <IconButton icon="chevronDown" label={`Move ${g.name || "group"} down`} disabled={i === v.groups.length - 1} onPress={() => move(i, 1)} />
              <IconButton icon="close" label={`Remove ${g.name || "group"}`} color={t.danger} disabled={v.groups.length === 1} onPress={() => remove(i)} />
            </View>
          );
        })}
        {v.groups.length < MAX_GROUPS && (
          <Button label="Add a group" icon="plus" onPress={() => setGroups([...v.groups, { name: "", was: null }])} />
        )}
      </Section>

      <Section title="Practice days">
        <T small muted style={{ marginBottom: 10 }}>Which days the team practices each week. Today's plan steps between these days.</T>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {WEEK.map((d) => {
            const on = v.practiceDays.includes(d);
            return (
              <Pressable key={d} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={d} onPress={() => toggleDay(d)}
                style={{ minWidth: 56, minHeight: 44, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 10,
                  borderColor: on ? t.accent : t.line, backgroundColor: on ? t.accent : t.surface }}>
                <Text style={{ color: on ? t.accentText : t.text, fontSize: 16, fontWeight: on ? "700" : "500" }}>{shortDay(d)}</Text>
              </Pressable>
            );
          })}
        </View>
      </Section>

      <Section title="Practice time">
        <Stepper label="Starts" value={formatClock(v.start, true)} step="15 minutes"
          onMinus={() => set({ start: v.start - 15 })} minusDisabled={v.start - 15 < 5 * 60}
          onPlus={() => set({ start: v.start + 15 })} plusDisabled={v.start + 15 >= v.end} />
        <Stepper label="Ends" value={formatClock(v.end, true)} step="15 minutes"
          onMinus={() => set({ end: v.end - 15 })} minusDisabled={v.end - 15 <= v.start}
          onPlus={() => set({ end: v.end + 15 })} plusDisabled={v.end + 15 > 23 * 60 + 45} />
        <T small muted style={{ marginBottom: 14 }}>{formatDuration(length)} practice.</T>
        <Stepper label="Team warm-up" value={`${v.warmupMinutes} min`} step="5 minutes"
          onMinus={() => set({ warmupMinutes: v.warmupMinutes - 5 })} minusDisabled={v.warmupMinutes < 5}
          onPlus={() => set({ warmupMinutes: v.warmupMinutes + 5 })} plusDisabled={middle < 5} />
        <Stepper label="Team stretch / cooldown" value={`${v.cooldownMinutes} min`} step="5 minutes"
          onMinus={() => set({ cooldownMinutes: v.cooldownMinutes - 5 })} minusDisabled={v.cooldownMinutes < 5}
          onPlus={() => set({ cooldownMinutes: v.cooldownMinutes + 5 })} plusDisabled={middle < 5} />
        <T small muted style={{ marginBottom: 12 }}>
          {middle >= 0 ? `Leaves ${formatDuration(middle)} for group work. ` : ""}An empty day can start from this outline: the warm-up first, the stretch at the end. Set either to 0 to leave it out.
        </T>
      </Section>
    </>
  );
}

function Stepper({ label, value, step, onMinus, onPlus, minusDisabled, plusDisabled }: {
  label: string; value: string; step: string; onMinus: () => void; onPlus: () => void; minusDisabled?: boolean; plusDisabled?: boolean;
}) {
  const t = useTheme();
  const btn = (icon: "minus" | "plus", onPress: () => void, disabled?: boolean, a11y?: string) => (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} disabled={disabled} onPress={onPress} hitSlop={4}
      style={({ pressed }) => ({ width: 48, height: 44, borderRadius: 12, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface,
        alignItems: "center", justifyContent: "center", opacity: disabled ? 0.35 : pressed ? 0.7 : 1 })}>
      <Icon name={icon} size={20} color={t.accent} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
      <Text style={{ flex: 1, color: t.text, fontSize: 15, fontWeight: "600" }}>{label}</Text>
      {btn("minus", onMinus, minusDisabled, `${label}: ${step} earlier or less`)}
      <Text accessibilityLiveRegion="polite" style={{ color: t.text, fontSize: 16, fontWeight: "600", minWidth: 84, textAlign: "center" }}>{value}</Text>
      {btn("plus", onPlus, plusDisabled, `${label}: ${step} later or more`)}
    </View>
  );
}
