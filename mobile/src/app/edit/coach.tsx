// Add or edit a coach. The Mon/Tue/Thu switches drive the lead-coach rotation.

import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useAppState } from "@/data/store";
import type { CoachInput } from "@/core/writes";
import { FormScreen, SwitchField, TextField } from "@/ui/form";
import { Empty, Screen } from "@/ui/kit";

export default function EditCoach() {
  const { data } = useAppState();
  const params = useLocalSearchParams<{ row?: string }>();
  const was = params.row ? data?.coaches.find((c) => c.row === Number(params.row)) : undefined;

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
        message: "This clears their row in the Sheet, which changes everyone's place in the rotation. To pause them, switch them to Inactive instead.",
      } : undefined}
      deleteLabel="Remove coach"
      note="Removing or deactivating a coach, or changing their days, reshuffles that day's rotation for the rest of the season.">
      <Stack.Screen options={{ title: was ? `Edit ${was.firstName}` : "Add a coach" }} />
      <TextField label="First name" value={v.firstName} onChange={(firstName) => set({ firstName })} autoCapitalize="words" />
      <TextField label="Last name" value={v.lastName} onChange={(lastName) => set({ lastName })} autoCapitalize="words" />
      <TextField label="Role" value={v.role} onChange={(role) => set({ role })} placeholder="e.g. Head Coach, Coach" autoCapitalize="words" />
      <SwitchField label="Coaches Mondays" value={v.coachesMonday} onChange={(coachesMonday) => set({ coachesMonday })} />
      <SwitchField label="Coaches Tuesdays" value={v.coachesTuesday} onChange={(coachesTuesday) => set({ coachesTuesday })} />
      <SwitchField label="Coaches Thursdays" value={v.coachesThursday} onChange={(coachesThursday) => set({ coachesThursday })} />
      <TextField label="Other days" value={v.otherDays} onChange={(otherDays) => set({ otherDays })} />
      <TextField label="Email" value={v.email} onChange={(email) => set({ email })} keyboardType="email-address" autoCapitalize="none"
        hint="Their Google account, if it's the same — the app uses it to fill in “Logged by”." />
      <TextField label="Phone" value={v.phone} onChange={(phone) => set({ phone })} keyboardType="phone-pad" />
      <TextField label="Specialties / certifications" value={v.specialties} onChange={(specialties) => set({ specialties })} multiline />
      <TextField label="Bio / notes" value={v.bio} onChange={(bio) => set({ bio })} multiline />
      <SwitchField label="Active" value={v.status === "Active"} onChange={(on) => set({ status: on ? "Active" : "Inactive" })} />
    </FormScreen>
  );
}
