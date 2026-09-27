// Add or edit one Progress Log entry.

import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useAppState } from "@/data/store";
import { signedInEmail } from "@/platform/auth";
import { METRIC_TYPES } from "@/core/schema/layout";
import { todayISO } from "@/core/logic/dates";
import type { ProgressInput } from "@/core/writes";
import { DateField } from "@/ui/DateField";
import { FormScreen, NOTES_HINT, SelectField, TextField } from "@/ui/form";
import { Empty, Screen } from "@/ui/kit";

export default function EditProgress() {
  const { data } = useAppState();
  const params = useLocalSearchParams<{ row?: string; athlete?: string }>();
  // The record as it was when the form opened: saving writes only what's changed from this,
  // and spots anything another coach changed meanwhile (a later refresh doesn't move it).
  const [was] = useState(() => (params.row ? data?.progress.find((p) => p.row === Number(params.row)) : undefined));

  const [v, setV] = useState<ProgressInput>(() => {
    if (was) { const { row: _row, ...rest } = was; return rest; }
    const athlete = data?.athletes.find((a) => a.row === Number(params.athlete));
    // Default "Logged by" to the coach whose email is the signed-in Google account.
    const email = signedInEmail()?.toLowerCase();
    const me = email ? data?.coaches.find((c) => c.email.toLowerCase() === email) : undefined;
    return { date: todayISO(), athleteFullName: athlete?.fullName ?? "", metricType: "", value: "", notes: "", loggedBy: me?.fullName ?? "" };
  });
  if (!data) return null;
  if (params.row && !was) return <Screen><Empty>That entry isn't in the Progress Log anymore.</Empty></Screen>;
  const set = (patch: Partial<ProgressInput>) => setV((cur) => ({ ...cur, ...patch }));

  return (
    <FormScreen
      build={() => (was ? { table: "progress", row: was.row, was, value: v } : { table: "progress", row: null, value: v })}
      onDelete={was ? { change: () => ({ table: "progress", row: was.row, was, value: null }), title: "Delete this entry?", message: "It will be removed from the Progress Log in the Sheet." } : undefined}
      deleteLabel="Delete entry">
      <Stack.Screen options={{ title: was ? "Edit progress" : "Log progress" }} />
      <SelectField label="Athlete" value={v.athleteFullName} onChange={(athleteFullName) => set({ athleteFullName })}
        options={data.athletes.filter((a) => a.status === "Active" || a.fullName === v.athleteFullName).map((a) => ({ value: a.fullName, sub: a.tier }))} />
      <DateField label="Date" value={v.date} onChange={(date) => set({ date })} />
      <SelectField label="Metric type" value={v.metricType} onChange={(metricType) => set({ metricType })} options={METRIC_TYPES.map((value) => ({ value }))} />
      <TextField label="Value" value={v.value} onChange={(value) => set({ value })} placeholder="e.g. V6, 2nd place, 45 s hang" />
      <TextField label="Notes / context" hint={NOTES_HINT} value={v.notes} onChange={(notes) => set({ notes })} multiline />
      <SelectField label="Logged by" value={v.loggedBy} onChange={(loggedBy) => set({ loggedBy })} allowBlank="—"
        options={data.coaches.filter((c) => c.status === "Active").map((c) => ({ value: c.fullName }))} />
    </FormScreen>
  );
}
