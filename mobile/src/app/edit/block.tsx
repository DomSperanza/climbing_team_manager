// Add or edit one block in Log a Workout. Picking from the library fills in the block type,
// description and sets — still editable afterwards, like typing over the Sheet's autofill.

import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useAppState } from "@/data/store";
import { ALL_COACHES, ALL_TEAM } from "@/core/schema/layout";
import { autofillFromLibrary } from "@/core/logic/library";
import { nextPracticeDay, todayISO, type ISODate } from "@/core/logic/dates";
import { practiceInfo } from "@/core/logic/rotation";
import type { BlockInput } from "@/core/writes";
import { DateField } from "@/ui/DateField";
import { FormScreen, SelectField, TextField } from "@/ui/form";
import { Empty, Screen } from "@/ui/kit";

export default function EditBlock() {
  const { data } = useAppState();
  const params = useLocalSearchParams<{ row?: string; date?: string }>();
  const was = params.row ? data?.log.find((b) => b.row === Number(params.row)) : undefined;

  const [v, setV] = useState<BlockInput>(() => {
    if (was) { const { row: _row, ...rest } = was; return rest; }
    const date: ISODate = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : nextPracticeDay(todayISO());
    const info = data ? practiceInfo(data.settings, data.coaches, date) : null;
    return {
      date,
      group: info?.featuredTier ?? ALL_TEAM,
      libraryItem: "", blockType: "", description: "", setsRepsDuration: "",
      coach: info?.lead && info.lead !== ALL_COACHES ? info.lead : "",
      notes: "",
    };
  });
  if (!data) return null;
  if (params.row && !was) return <Screen><Empty>That block isn't in the workout log anymore.</Empty></Screen>;
  const set = (patch: Partial<BlockInput>) => setV((cur) => ({ ...cur, ...patch }));
  const { settings, library, coaches } = data;

  const pickExercise = (name: string) => {
    const fill = autofillFromLibrary(library, name);
    set({ libraryItem: name, ...(fill ?? {}) });
  };

  return (
    <FormScreen
      build={() => (was ? { table: "log", row: was.row, was, value: v } : { table: "log", row: null, value: v })}
      onDelete={was ? { change: () => ({ table: "log", row: was.row, was, value: null }), title: "Delete this block?", message: `"${was.libraryItem || was.blockType || "This block"}" will be removed from the plan in the Sheet.` } : undefined}
      deleteLabel="Delete block">
      <Stack.Screen options={{ title: was ? "Edit block" : "Add a block" }} />
      <DateField label="Date" value={v.date} onChange={(date) => set({ date })} />
      <SelectField label="Group" value={v.group} onChange={(group) => set({ group })}
        options={[...settings.tierNames.filter(Boolean), ALL_TEAM].map((value) => ({ value }))} />
      <SelectField label="Pick from library" hint="Optional. Fills in the fields below, which you can still change." value={v.libraryItem}
        allowBlank="None — type it in below" onChange={(name) => (name ? pickExercise(name) : set({ libraryItem: "" }))}
        options={library.map((e) => ({ value: e.name, sub: [e.blockType, e.tier].filter(Boolean).join(" · ") }))} />
      <SelectField label="Block type" value={v.blockType} onChange={(blockType) => set({ blockType })} allowBlank="—"
        options={settings.blockTypes.map((value) => ({ value }))} />
      <TextField label="Description" value={v.description} onChange={(description) => set({ description })} multiline />
      <TextField label="Sets × reps / duration" value={v.setsRepsDuration} onChange={(setsRepsDuration) => set({ setsRepsDuration })} placeholder="e.g. 3 × 5, 10 min" />
      <SelectField label="Coach" value={v.coach} onChange={(coach) => set({ coach })} allowBlank="—"
        options={coaches.filter((c) => c.status === "Active").map((c) => ({ value: c.fullName, sub: c.role }))} />
      <TextField label="Notes" value={v.notes} onChange={(notes) => set({ notes })} multiline />
    </FormScreen>
  );
}
