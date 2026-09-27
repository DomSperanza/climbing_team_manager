// Every saved practice for one athlete, newest first, split by day — what they did, their
// group that day, notes, and the days they missed. Filter to see only missed or moved days.

import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { athleteHistory } from "@/core/logic/attendance";
import { useAppState } from "@/data/store";
import { AthleteDay } from "@/ui/AthleteDay";
import { Empty, FilterChips, Screen, T } from "@/ui/kit";

type Show = "" | "missed" | "moved" | "notes";

export default function AthleteWorkouts() {
  const { data } = useAppState();
  const { row } = useLocalSearchParams<{ row: string }>();
  const [show, setShow] = useState<Show>("");
  const athlete = data?.athletes.find((a) => a.row === Number(row));
  if (!data) return null;
  if (!athlete) return <Screen><Empty>That athlete isn't on the roster anymore.</Empty></Screen>;

  const history = athleteHistory(data, athlete);
  const here = history.filter((h) => h.entry.here).length;
  const minutes = history.reduce((sum, h) => sum + h.blocks.reduce((m, b) => m + (b.block.minutes ?? 0), 0), 0);
  const shown = history.filter(({ entry: e }) =>
    show === "missed" ? !e.here : show === "moved" ? e.here && e.group !== athlete.tier : show === "notes" ? !!e.notes : true);

  return (
    <Screen>
      <Stack.Screen options={{ title: athlete.fullName }} />
      <T muted style={{ marginBottom: 10 }}>
        There for {here} of {history.length} saved practice{history.length === 1 ? "" : "s"}{minutes ? ` · ${Math.round(minutes / 60)} h of planned training` : ""}.
      </T>
      <FilterChips label="Show" value={show} onChange={setShow} options={[
        { value: "", label: "All days" }, { value: "missed", label: "Missed" }, { value: "moved", label: "Other group" }, { value: "notes", label: "With notes" },
      ]} />
      {shown.length === 0
        ? <Empty>{history.length ? "No days match." : "No workouts saved yet."}</Empty>
        : shown.map((h) => <AthleteDay key={h.entry.date} record={h} athlete={athlete} tierNames={data.settings.tierNames} />)}
    </Screen>
  );
}
