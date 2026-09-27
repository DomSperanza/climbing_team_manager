// "Create a new team Sheet": name it, set up the season, sign in, and the app makes a private
// copy of the team workbook in the coach's Google Drive, ready to use.

import { Stack } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { createTeamSheet, useAppState } from "@/data/store";
import { todayISO } from "@/core/logic/dates";
import { nextThursday, type NewSheetOptions } from "@/core/setup";
import { DateField } from "@/ui/DateField";
import { SwitchField, TextField } from "@/ui/form";
import { Banner, Button, Card, MAX_WIDTH, Row, Section, T } from "@/ui/kit";
import { useTheme } from "@/ui/theme";

function defaults(): NewSheetOptions {
  const now = new Date();
  const y = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1; // seasons start in the fall
  return {
    name: `Rock Team ${y}–${String((y + 1) % 100).padStart(2, "0")}`,
    tierNames: ["Advanced", "Intermediate", "Developing"],
    seasonStart: nextThursday(todayISO()),
    numberOfWeeks: 16,
    keepLibrary: true,
    me: { firstName: "", lastName: "", role: "Head Coach", email: "", coachesMonday: false, coachesTuesday: false, coachesThursday: true },
  };
}

type Me = NonNullable<NewSheetOptions["me"]>;

export default function Setup() {
  const t = useTheme();
  const s = useAppState();
  const [o, setO] = useState<NewSheetOptions>(() => s.setupDraft ?? defaults());
  const [addMe, setAddMe] = useState(o.me !== null);
  const [me, setMe] = useState<Me>(() => o.me ?? defaults().me!);
  const [weeks, setWeeks] = useState(String(o.numberOfWeeks));
  const set = (patch: Partial<NewSheetOptions>) => setO((cur) => ({ ...cur, ...patch }));
  const setTier = (i: number, v: string) => setO((cur) => {
    const tierNames = [...cur.tierNames] as NewSheetOptions["tierNames"];
    tierNames[i] = v;
    return { ...cur, tierNames };
  });
  const setMeField = (patch: Partial<Me>) => setMe((cur) => ({ ...cur, ...patch }));
  const busy = s.loading && !!s.setupStep;

  const create = () => createTeamSheet({ ...o, numberOfWeeks: Number(weeks), me: addMe ? me : null });

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Stack.Screen options={{ title: "New team Sheet" }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, width: "100%", maxWidth: MAX_WIDTH, alignSelf: "center" }} keyboardShouldPersistTaps="handled">
        <T muted style={{ marginBottom: 16 }}>
          This makes a new Google Sheet in your Drive with every tab, formula, dropdown and color from the team workbook.
          Only you can open it until you share it (More → Share this Sheet).
        </T>

        <TextField label="Sheet name" value={o.name} onChange={(name) => set({ name })} autoCapitalize="words" />

        <Section title="Tiers">
          <T small muted style={{ marginBottom: 10 }}>Thursdays rotate through these in order — tier 1 in week 1, tier 2 in week 2, tier 3 in week 3 — then an All Team week. You can rename them later in the Sheet's Settings tab.</T>
          {(["Tier 1", "Tier 2", "Tier 3"] as const).map((label, i) => (
            <TextField key={label} label={label} value={o.tierNames[i]} onChange={(v) => setTier(i, v)} autoCapitalize="words" />
          ))}
        </Section>

        <Section title="Season">
          <DateField label="First Thursday of the season" value={o.seasonStart} onChange={(seasonStart) => set({ seasonStart })} />
          <TextField label="Number of weeks" value={weeks} onChange={(v) => setWeeks(v.replace(/[^\d]/g, ""))} keyboardType="phone-pad" />
          <SwitchField label="Start with the exercise library" hint="About 20 exercises from the team's own practice plans. Edit or delete them any time." value={o.keepLibrary}
            onChange={(keepLibrary) => set({ keepLibrary })} />
        </Section>

        <Section title="You">
          <SwitchField label="Add me as a coach" hint="So the rotation has someone in it from the start." value={addMe} onChange={setAddMe} />
          {addMe && (
            <Card>
              <TextField label="First name" value={me.firstName} onChange={(firstName) => setMeField({ firstName })} autoCapitalize="words" />
              <TextField label="Last name" value={me.lastName} onChange={(lastName) => setMeField({ lastName })} autoCapitalize="words" />
              <TextField label="Role" value={me.role} onChange={(role) => setMeField({ role })} autoCapitalize="words" />
              <SwitchField label="I coach Mondays" value={me.coachesMonday} onChange={(coachesMonday) => setMeField({ coachesMonday })} />
              <SwitchField label="I coach Tuesdays" value={me.coachesTuesday} onChange={(coachesTuesday) => setMeField({ coachesTuesday })} />
              <SwitchField label="I coach Thursdays" value={me.coachesThursday} onChange={(coachesThursday) => setMeField({ coachesThursday })} />
            </Card>
          )}
        </Section>

        <View style={{ marginTop: 20 }}>
          {s.error && s.setupDraft && !busy ? <View style={{ marginHorizontal: -16, marginBottom: 12 }}><Banner kind="error">{s.error}</Banner></View> : null}
          {!s.online && <View style={{ marginHorizontal: -16, marginBottom: 12 }}><Banner>You're offline — creating a Sheet needs a connection.</Banner></View>}
          {busy ? (
            <Row style={{ justifyContent: "center", minHeight: 48 }}>
              <ActivityIndicator color={t.accent} />
              <T>{s.setupStep}</T>
            </Row>
          ) : (
            <Button label="Sign in with Google & create" kind="primary" disabled={!s.online || s.loading} onPress={create} />
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
