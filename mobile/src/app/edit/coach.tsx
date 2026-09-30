// Add or edit a coach. A switch per practice day (Team settings) decides which days they're listed as on.

import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useAppState } from "@/data/store";
import type { CoachInput } from "@/core/writes";
import { coachesDay, withCoachDay } from "@/core/logic/coachDays";
import { FormScreen, SwitchField, TextField } from "@/ui/form";
import { Empty, Screen } from "@/ui/kit";

export default function EditCoach() {
  const { data } = useAppState();
  const params = useLocalSearchParams<{ row?: string }>();
  // The record as it was when the form opened: saving writes only what's changed from this,
  // and spots anything another coach changed meanwhile (a later refresh doesn't move it).
  const [was] = useState(() => (params.row ? data?.coaches.find((c) => c.row === Number(params.row)) : undefined));

  const [v, setV] = useState<CoachInput>(() => {
    if (was) { const { row: _r, id: _i, fullName: _f, ...rest } = was; return rest; }
    return {
      firstName: "", lastName: "", role: "Coach", coachesMonday: false, coachesTuesday: false, coachesThursday: false,
      otherDays: "", email: "", phone: "", specialties: "", bio: "", status: "Active",
    };
  });
  if (!data) return null;
  if (params.row && !was) return <Screen><Empty>That coach isn't in the Sheet anymore.</Empty></Screen>;
  const set = (patch: Partial<CoachInput>) => setV((cur) => ({ ...cur, ...patch }));

  return (
    <FormScreen
      build={() => (was ? { table: "coaches", row: was.row, was, value: v } : { table: "coaches", row: null, value: v })}
      onDelete={was ? {
        change: () => ({ table: "coaches", row: was.row, was, value: null }),
        title: `Remove ${was.fullName}?`,
        message: "This clears their row in the Sheet. To pause them instead, switch them to Inactive.",
      } : undefined}
      deleteLabel="Remove coach">
      <Stack.Screen options={{ title: was ? `Edit ${was.firstName}` : "Add a coach" }} />
      <TextField label="First name" value={v.firstName} onChange={(firstName) => set({ firstName })} autoCapitalize="words" />
      <TextField label="Last name" value={v.lastName} onChange={(lastName) => set({ lastName })} autoCapitalize="words" />
      <TextField label="Role" value={v.role} onChange={(role) => set({ role })} placeholder="e.g. Head Coach, Coach" autoCapitalize="words" />
      {data.settings.practiceDays.map((day) => (
        <SwitchField key={day} label={`Coaches ${day}s`} value={coachesDay(v, day)} onChange={(on) => setV((cur) => withCoachDay(cur, day, on))} />
      ))}
      <TextField label="Email" value={v.email} onChange={(email) => set({ email })} keyboardType="email-address" autoCapitalize="none"
        hint="Their Google account, if it's the same — the app uses it to fill in “Logged by”." />
      <TextField label="Phone" value={v.phone} onChange={(phone) => set({ phone })} keyboardType="phone-pad" />
      <TextField label="Specialties / certifications" value={v.specialties} onChange={(specialties) => set({ specialties })} multiline />
      <TextField label="Bio / notes" value={v.bio} onChange={(bio) => set({ bio })} multiline />
      <SwitchField label="Active" value={v.status === "Active"} onChange={(on) => set({ status: on ? "Active" : "Inactive" })} />
    </FormScreen>
  );
}
