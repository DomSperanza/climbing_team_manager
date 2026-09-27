// One athlete on one practice day: whether they were there, their group that day (e.g. an
// Intermediate climber joining Advanced), and a brief note. Shows what that means they did.

import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { recordFor, workoutFor } from "@/core/logic/attendance";
import { formatLong } from "@/core/logic/dates";
import { formatClock } from "@/core/logic/timeline";
import { setAthleteDay, useAppState } from "@/data/store";
import { FormScreen, NOTES_HINT, SelectField, SwitchField, TextField } from "@/ui/form";
import { Card, Empty, Row, Screen, Section, T } from "@/ui/kit";

export default function EditAttendance() {
  const { data } = useAppState();
  const { date, athlete: name } = useLocalSearchParams<{ date: string; athlete: string }>();
  const athlete = data?.athletes.find((a) => a.fullName === name);
  const existing = data && date && name ? recordFor(data, date, name) : undefined;
  const [group, setGroup] = useState(existing?.group ?? athlete?.tier ?? "");
  const [here, setHere] = useState(existing?.here ?? true);
  const [notes, setNotes] = useState(existing?.notes ?? "");
  if (!data) return null;
  if (!date || !name) return <Screen><Empty>Nothing to edit.</Empty></Screen>;

  const blocks = here ? workoutFor(data, date, group) : [];
  return (
    <FormScreen onSave={() => setAthleteDay(date, name, { group, here, notes })}>
      <Stack.Screen options={{ title: name }} />
      <T muted style={{ marginBottom: 12 }}>{formatLong(date)}, {date.slice(0, 4)}</T>
      <SwitchField label="Was there" hint={here ? undefined : "Kept as a missed practice in their history."} value={here} onChange={setHere} />
      {here && (
        <SelectField label="Group for this day" hint={athlete?.tier && group !== athlete.tier ? `Usually ${athlete.tier}.` : undefined}
          value={group} onChange={setGroup} options={data.settings.tierNames.filter(Boolean).map((value) => ({ value }))} />
      )}
      <TextField label="Notes" hint={`Brief. ${NOTES_HINT}`} value={notes} onChange={setNotes} multiline placeholder="e.g. Sent the V5 project; left early" />
      {here && (
        <Section title="What they did">
          {blocks.length ? (
            <Card>
              <View style={{ gap: 4 }}>
                {blocks.map(({ block: b, start }) => (
                  <Row key={b.row} style={{ flexWrap: "nowrap", gap: 8 }}>
                    <T small muted style={{ width: 40 }}>{b.minutes !== null ? formatClock(start) : ""}</T>
                    <T small style={{ flex: 1 }}>{b.libraryItem || b.blockType || b.description || "Block"}</T>
                    {b.minutes !== null && <T small muted>{b.minutes} min</T>}
                  </Row>
                ))}
              </View>
            </Card>
          ) : <Empty>Nothing planned for {group || "this group"} that day.</Empty>}
        </Section>
      )}
      <View style={{ height: 16 }} />
    </FormScreen>
  );
}
