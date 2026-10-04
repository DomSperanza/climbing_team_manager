// "Create a new team Sheet": name it, set up its groups, practice days and times, sign in,
// and the app makes a private copy of the team workbook in the coach's Google Drive, ready to use.
// Reached from the Connect screen, or (as /new-team, `another`) from More while already
// connected — e.g. a younger team with its own days and times gets a Sheet of its own.

import { router, Stack } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { createTeamSheet, useAppState } from "@/data/store";
import type { Weekday } from "@/core/logic/dates";
import { DEFAULT_PRACTICE } from "@/core/logic/timeline";
import type { NewSheetOptions } from "@/core/setup";
import { SwitchField, TextField } from "@/ui/form";
import { Banner, Button, Card, MAX_WIDTH, Row, Section, T } from "@/ui/kit";
import { TeamSetupFields } from "@/ui/TeamSetupFields";
import { useTheme } from "@/ui/theme";

function defaults(): NewSheetOptions {
  const now = new Date();
  const y = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1; // seasons start in the fall
  return {
    name: `SCC Climbing Team ${y}–${String((y + 1) % 100).padStart(2, "0")}`,
    team: {
      groups: ["Advanced", "Intermediate", "Developing"].map((name) => ({ name, was: null })),
      practiceDays: ["Monday", "Tuesday", "Thursday"],
      start: DEFAULT_PRACTICE.start, end: DEFAULT_PRACTICE.end,
      warmupMinutes: DEFAULT_PRACTICE.warmupMinutes, cooldownMinutes: DEFAULT_PRACTICE.cooldownMinutes,
    },
    keepLibrary: true,
    me: { firstName: "", lastName: "", role: "Head Coach", email: "", days: [] },
  };
}

type Me = NonNullable<NewSheetOptions["me"]>;

export default function Setup({ another = false }: { another?: boolean }) {
  const t = useTheme();
  const s = useAppState();
  // A draft from before this form had team settings (an older version, mid sign-in) starts over.
  const [o, setO] = useState<NewSheetOptions>(() => (s.setupDraft?.team ? s.setupDraft : defaults()));
  const [addMe, setAddMe] = useState(o.me !== null);
  const [me, setMe] = useState<Me>(() => o.me ?? defaults().me!);
  const set = (patch: Partial<NewSheetOptions>) => setO((cur) => ({ ...cur, ...patch }));
  const setMeField = (patch: Partial<Me>) => setMe((cur) => ({ ...cur, ...patch }));
  const toggleMyDay = (d: Weekday, on: boolean) => setMeField({ days: on ? [...me.days, d] : me.days.filter((x) => x !== d) });
  const busy = s.loading && !!s.setupStep;

  const create = async () => {
    const ok = await createTeamSheet({ ...o, me: addMe ? { ...me, days: me.days.filter((d) => o.team.practiceDays.includes(d)) } : null });
    // From the Connect screen, connecting takes the app to the new Sheet by itself.
    if (ok && another && router.canGoBack()) router.back();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Stack.Screen options={{ title: "New team Sheet" }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, width: "100%", maxWidth: MAX_WIDTH, alignSelf: "center" }} keyboardShouldPersistTaps="handled">
        <T muted style={{ marginBottom: 16 }}>
          This makes a new Google Sheet in your Drive for one team, with its own roster, plans and exercise library.
          Only you can open it until you share it (More → Share this Sheet). Everything here can be changed later in More → Team settings.
          {another ? " The app switches to the new Sheet once it's made; switch back any time under More → Switch to another Sheet." : ""}
        </T>

        <TextField label="Sheet name" value={o.name} onChange={(name) => set({ name })} autoCapitalize="words" />

        <TeamSetupFields value={o.team} onChange={(team) => set({ team })} />

        <Section title="Exercises">
          <SwitchField label="Start with the exercise library" hint="About 20 exercises from the original team's plans. Its Advanced, Intermediate and Developing exercises go to your groups, top to bottom. Edit or delete them any time." value={o.keepLibrary}
            onChange={(keepLibrary) => set({ keepLibrary })} />
        </Section>

        <Section title="You">
          <SwitchField label="Add me as a coach" value={addMe} onChange={setAddMe} />
          {addMe && (
            <Card>
              <TextField label="First name" value={me.firstName} onChange={(firstName) => setMeField({ firstName })} autoCapitalize="words" />
              <TextField label="Last name" value={me.lastName} onChange={(lastName) => setMeField({ lastName })} autoCapitalize="words" />
              <TextField label="Role" value={me.role} onChange={(role) => setMeField({ role })} autoCapitalize="words" />
              {o.team.practiceDays.map((d) => (
                <SwitchField key={d} label={`I coach ${d}s`} value={me.days.includes(d)} onChange={(on) => toggleMyDay(d, on)} />
              ))}
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
