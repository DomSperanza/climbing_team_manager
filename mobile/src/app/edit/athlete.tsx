// Add or edit an athlete. Age is deliberately not on this form (HANDOFF.md §1.6).

import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useAppState } from "@/data/store";
import { todayISO } from "@/core/logic/dates";
import type { AthleteInput } from "@/core/writes";
import { DateField } from "@/ui/DateField";
import { FormScreen, NOTES_HINT, SelectField, SwitchField, TextField } from "@/ui/form";
import { Empty, Screen } from "@/ui/kit";

export default function EditAthlete() {
  const { data } = useAppState();
  const params = useLocalSearchParams<{ row?: string }>();
  const was = params.row ? data?.athletes.find((a) => a.row === Number(params.row)) : undefined;

  const [v, setV] = useState<AthleteInput>(() => {
    if (was) { const { row: _r, id: _i, fullName: _f, ...rest } = was; return rest; }
    return {
      firstName: "", lastName: "", tier: "", currentFlashGrade: "", goalGrade: "", strengths: "", growthAreas: "",
      currentFocus: "", joinDate: todayISO(), status: "Active", notes: "",
    };
  });
  if (!data) return null;
  if (params.row && !was) return <Screen><Empty>That athlete isn't on the roster anymore.</Empty></Screen>;
  const set = (patch: Partial<AthleteInput>) => setV((cur) => ({ ...cur, ...patch }));
  const renamed = was && (v.firstName.trim() !== was.firstName || v.lastName.trim() !== was.lastName);
  const progressCount = was ? data.progress.filter((p) => p.athleteFullName.toLowerCase() === was.fullName.toLowerCase()).length : 0;

  return (
    <FormScreen
      build={() => (was ? { table: "athletes", row: was.row, was, value: v } : { table: "athletes", row: null, value: v })}
      onDelete={was ? {
        change: () => ({ table: "athletes", row: was.row, was, value: null }),
        title: `Remove ${was.fullName}?`,
        message: "This clears their row in the Sheet and can't be undone from the app. To keep their history, switch them to Inactive instead.",
        leaveTo: "list",
      } : undefined}
      deleteLabel="Remove from roster"
      note={renamed && progressCount ? `Progress entries are matched by name, so renaming disconnects their ${progressCount} past entr${progressCount === 1 ? "y" : "ies"}.` : undefined}>
      <Stack.Screen options={{ title: was ? `Edit ${was.firstName}` : "Add an athlete" }} />
      <TextField label="First name" value={v.firstName} onChange={(firstName) => set({ firstName })} autoCapitalize="words" />
      <TextField label="Last name" value={v.lastName} onChange={(lastName) => set({ lastName })} autoCapitalize="words" />
      <SelectField label="Group" value={v.tier} onChange={(tier) => set({ tier })} allowBlank="—"
        options={data.settings.tierNames.filter(Boolean).map((value) => ({ value }))} />
      <TextField label="Current flash grade" value={v.currentFlashGrade} onChange={(currentFlashGrade) => set({ currentFlashGrade })} placeholder="e.g. V4" autoCapitalize="none" />
      <TextField label="Goal grade" value={v.goalGrade} onChange={(goalGrade) => set({ goalGrade })} placeholder="e.g. V6" autoCapitalize="none" />
      <TextField label="Current focus / goal" value={v.currentFocus} onChange={(currentFocus) => set({ currentFocus })} multiline />
      <TextField label="Strengths" value={v.strengths} onChange={(strengths) => set({ strengths })} multiline />
      <TextField label="Growth areas" value={v.growthAreas} onChange={(growthAreas) => set({ growthAreas })} multiline />
      <TextField label="Notes" hint={NOTES_HINT} value={v.notes} onChange={(notes) => set({ notes })} multiline />
      <DateField label="Join date" value={v.joinDate} onChange={(joinDate) => set({ joinDate })} />
      <SwitchField label="Active" hint="Inactive athletes are hidden from the roster but keep their history." value={v.status === "Active"}
        onChange={(on) => set({ status: on ? "Active" : "Inactive" })} />
    </FormScreen>
  );
}
