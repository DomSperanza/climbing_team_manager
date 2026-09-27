// Add or edit one block in Log a Workout. Picking from the library fills in the block type,
// description, sets and (when the library says, e.g. "10 min") the length — all still
// editable afterwards, like typing over the Sheet's autofill.

import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useAppState } from "@/data/store";
import { ALL_TEAM } from "@/core/schema/layout";
import { autofillFromLibrary } from "@/core/logic/library";
import { blockGroups, formatClock, dayTimeline, minutesFromText, orderForNew } from "@/core/logic/timeline";
import { nextPracticeDay, todayISO, type ISODate } from "@/core/logic/dates";
import { coachForGroup } from "@/core/logic/assignments";
import type { BlockInput } from "@/core/writes";
import { DateField } from "@/ui/DateField";
import { ExercisePicker } from "@/ui/ExercisePicker";
import { FormScreen, GroupPicker, MinutesField, SelectField, TextField } from "@/ui/form";
import { Empty, Screen } from "@/ui/kit";

export default function EditBlock() {
  const { data } = useAppState();
  // For a block shared by several groups, the first one decides the default coach.
  const firstGroup = (group: string) => (data ? blockGroups(group, data.settings.tierNames)?.[0] : undefined) ?? ALL_TEAM;
  const params = useLocalSearchParams<{ row?: string; date?: string; group?: string }>();
  // The record as it was when the form opened: saving writes only what's changed from this,
  // and spots anything another coach changed meanwhile (a later refresh doesn't move it).
  const [was] = useState(() => (params.row ? data?.log.find((b) => b.row === Number(params.row)) : undefined));

  const [v, setV] = useState<BlockInput>(() => {
    if (was) { const { row: _row, ...rest } = was; return rest; }
    const date: ISODate = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : nextPracticeDay(todayISO());
    const group = params.group || ALL_TEAM;
    return {
      date,
      group,
      libraryItem: "", blockType: "", description: "", setsRepsDuration: "",
      // Whoever has this group that day, else the day's lead.
      coach: (data && (coachForGroup(data, date, firstGroup(group)) ?? coachForGroup(data, date, ALL_TEAM))) ?? "",
      notes: "", minutes: null, order: null, // order is chosen when saving (see below)
    };
  });
  if (!data) return null;
  if (params.row && !was) return <Screen><Empty>That block isn't in the workout log anymore.</Empty></Screen>;
  const set = (patch: Partial<BlockInput>) => setV((cur) => ({ ...cur, ...patch }));
  const { settings, library, coaches, log } = data;

  // Where this block lands in its day: an existing block keeps its place (unless it moves to
  // another day); a new one goes at the end, before a closing stretch.
  const others = log.filter((b) => b.date === v.date && b.row !== was?.row);
  const order = was && was.date === v.date ? was.order : orderForNew(others);
  const draft = { ...v, order, row: was?.row ?? -1 };
  const timed = dayTimeline([...others, draft], settings.practice, settings.tierNames).blocks.find((b) => b.block.row === draft.row);
  const timing = v.minutes && timed ? `Runs ${formatClock(timed.start)}–${formatClock(timed.end, true)} on this day's plan.` : "Set a length to place it on the practice timeline.";

  const pickExercise = (name: string) => {
    if (!name) return set({ libraryItem: "" });
    const fill = autofillFromLibrary(library, name);
    set({ libraryItem: name, ...(fill ?? {}), ...(v.minutes === null && fill ? { minutes: minutesFromText(fill.setsRepsDuration) } : {}) });
  };
  const value = (): BlockInput => ({ ...v, order });

  return (
    <FormScreen
      build={() => (was ? { table: "log", row: was.row, was, value: value() } : { table: "log", row: null, value: value() })}
      onDelete={was ? { change: () => ({ table: "log", row: was.row, was, value: null }), title: "Delete this block?", message: `"${was.libraryItem || was.blockType || "This block"}" will be removed from the plan in the Sheet.` } : undefined}
      deleteLabel="Delete block">
      <Stack.Screen options={{ title: was ? "Edit block" : "Add a block" }} />
      <GroupPicker value={v.group} tierNames={settings.tierNames} onChange={(group) => {
        // The coach follows the (first) group, unless someone picked a coach by hand.
        const previousDefault = coachForGroup(data, v.date, firstGroup(v.group)) ?? "";
        set(!v.coach || v.coach === previousDefault ? { group, coach: coachForGroup(data, v.date, firstGroup(group)) ?? v.coach } : { group });
      }} />
      <ExercisePicker data={data} value={v.libraryItem} onChange={pickExercise} tier={v.group} />
      <MinutesField value={v.minutes} onChange={(minutes) => set({ minutes })} hint={timing} />
      <SelectField label="Block type" value={v.blockType} onChange={(blockType) => set({ blockType })} allowBlank="—"
        options={settings.blockTypes.map((bt) => ({ value: bt }))} />
      <TextField label="Description" value={v.description} onChange={(description) => set({ description })} multiline />
      <TextField label="Sets × reps" value={v.setsRepsDuration} onChange={(setsRepsDuration) => set({ setsRepsDuration })} placeholder="e.g. 3 × 5, 6 boulders × 2" />
      <SelectField label="Coach" value={v.coach} onChange={(coach) => set({ coach })} allowBlank="—"
        options={coaches.filter((c) => c.status === "Active").map((c) => ({ value: c.fullName, sub: c.role }))} />
      <TextField label="Notes" value={v.notes} onChange={(notes) => set({ notes })} multiline />
      <DateField label="Date" value={v.date} onChange={(date) => set({ date })} />
    </FormScreen>
  );
}
