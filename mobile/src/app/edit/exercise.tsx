// Add or edit an Exercise Library entry.

import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useAppState } from "@/data/store";
import { ALL_LEVELS } from "@/core/schema/layout";
import { timesUsed } from "@/core/logic/library";
import type { ExerciseInput } from "@/core/writes";
import { FormScreen, SelectField, TextField } from "@/ui/form";
import { Empty, Screen } from "@/ui/kit";

export default function EditExercise() {
  const { data } = useAppState();
  const params = useLocalSearchParams<{ row?: string }>();
  const was = params.row ? data?.library.find((e) => e.row === Number(params.row)) : undefined;

  const [v, setV] = useState<ExerciseInput>(() => {
    if (was) { const { row: _r, id: _i, ...rest } = was; return rest; }
    return { blockType: "", tier: ALL_LEVELS, name: "", description: "", setsRepsDuration: "", equipment: "", notesSource: "" };
  });
  if (!data) return null;
  if (params.row && !was) return <Screen><Empty>That exercise isn't in the library anymore.</Empty></Screen>;
  const set = (patch: Partial<ExerciseInput>) => setV((cur) => ({ ...cur, ...patch }));
  const used = was ? timesUsed(data.log, was.name) : 0;
  const renamed = was && v.name.trim().toLowerCase() !== was.name.toLowerCase();
  const duplicate = data.library.some((e) => e.row !== was?.row && e.name.toLowerCase() === v.name.trim().toLowerCase());

  return (
    <FormScreen
      build={() => (was ? { table: "library", row: was.row, was, value: v } : { table: "library", row: null, value: v })}
      onDelete={was ? {
        change: () => ({ table: "library", row: was.row, was, value: null }),
        title: `Delete "${was.name}"?`,
        message: "It will be removed from the Exercise Library. Workout blocks that already used it keep their details.",
        leaveTo: "list",
      } : undefined}
      deleteLabel="Delete exercise"
      note={duplicate ? "Another exercise already has this name — workouts pick exercises by name, so give it a different one."
        : renamed && used ? `Workouts pick exercises by name, so the ${used} block${used === 1 ? "" : "s"} that used "${was?.name}" will stop counting toward Times Used.` : undefined}>
      <Stack.Screen options={{ title: was ? "Edit exercise" : "Add an exercise" }} />
      <TextField label="Name" value={v.name} onChange={(name) => set({ name })} autoCapitalize="words" />
      <SelectField label="Block type" value={v.blockType} onChange={(blockType) => set({ blockType })} allowBlank="—"
        options={data.settings.blockTypes.map((value) => ({ value }))} />
      <SelectField label="Tier" value={v.tier} onChange={(tier) => set({ tier })}
        options={[...data.settings.tierNames.filter(Boolean), ALL_LEVELS].map((value) => ({ value }))} />
      <TextField label="Description / instructions" value={v.description} onChange={(description) => set({ description })} multiline />
      <TextField label="Suggested sets × reps / duration" value={v.setsRepsDuration} onChange={(setsRepsDuration) => set({ setsRepsDuration })} />
      <TextField label="Equipment" value={v.equipment} onChange={(equipment) => set({ equipment })} />
      <TextField label="Notes / source" value={v.notesSource} onChange={(notesSource) => set({ notesSource })} multiline />
    </FormScreen>
  );
}
