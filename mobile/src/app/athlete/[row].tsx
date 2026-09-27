// One athlete's profile: details, recent workouts (from saved practices) and their Progress
// Log. Edit the profile, open their full workout history, or log progress from here.

import { router, Stack, useLocalSearchParams } from "expo-router";
import { Pressable, View } from "react-native";
import { useAppState } from "@/data/store";
import { formatShort } from "@/core/logic/dates";
import { athleteHistory } from "@/core/logic/attendance";
import type { Athlete } from "@/core/schema/model";
import { AthleteDay } from "@/ui/AthleteDay";
import { Button, Card, Empty, Field, H2, IconButton, LinkButton, MutedChip, Row, Screen, Section, T, TierChip } from "@/ui/kit";
import { useTheme } from "@/ui/theme";

const longDate = (d: string | null) => (d ? `${formatShort(d)}, ${d.slice(0, 4)}` : "");

export default function AthleteDetail() {
  const t = useTheme();
  const { data } = useAppState();
  const { row } = useLocalSearchParams<{ row: string }>();
  const a = data?.athletes.find((x) => x.row === Number(row));
  if (!data) return null;
  if (!a) return <Screen><Empty>That athlete isn't on the roster anymore.</Empty></Screen>;

  // Progress Log links to athletes by full name (see HANDOFF.md) — a rename breaks the link.
  const entries = data.progress
    .filter((p) => p.athleteFullName.toLowerCase() === a.fullName.toLowerCase())
    .sort((x, y) => (y.date ?? "").localeCompare(x.date ?? ""));

  return (
    <Screen>
      <Stack.Screen options={{
        title: a.fullName,
        headerRight: () => <IconButton icon="edit" label="Edit profile" onPress={() => router.push({ pathname: "/edit/athlete", params: { row: String(a.row) } })} />,
      }} />
      <H2>{a.fullName}</H2>
      <Row style={{ marginTop: 6 }}>
        <TierChip tier={a.tier} tierNames={data.settings.tierNames} />
        {a.status === "Inactive" && <MutedChip label="Inactive" />}
      </Row>
      <Row style={{ marginVertical: 14, gap: 12, flexWrap: "nowrap" }}>
        {[["Flash grade", a.currentFlashGrade], ["Goal", a.goalGrade]].map(([label, v]) => (
          <Card key={label} style={{ flex: 1, alignItems: "center", marginBottom: 0 }}>
            <T style={{ fontSize: 28, lineHeight: 34, fontWeight: "800", color: t.accent }}>{v || "—"}</T>
            <T small muted>{label}</T>
          </Card>
        ))}
      </Row>
      <Card>
        <Field label="Current focus / goal" value={a.currentFocus} />
        <Field label="Strengths" value={a.strengths} />
        <Field label="Growth areas" value={a.growthAreas} />
        <Field label="Notes" value={a.notes} />
        <Field label="Joined" value={longDate(a.joinDate)} />
        {!a.currentFocus && !a.strengths && !a.growthAreas && !a.notes && !a.joinDate && <T muted>No details yet — tap the pencil to add some.</T>}
      </Card>
      <Workouts athlete={a} />
      <Section title={`Progress (${entries.length})`}>
        <Button label="Log progress" icon="plus" kind="primary" style={{ marginBottom: 10 }}
          onPress={() => router.push({ pathname: "/edit/progress", params: { athlete: String(a.row) } })} />
        {entries.length === 0 ? <Empty>No progress entries yet.</Empty> : entries.map((p) => (
          <Pressable key={p.row} accessibilityRole="button" accessibilityHint="Edit this entry"
            onPress={() => router.push({ pathname: "/edit/progress", params: { row: String(p.row) } })}>
            <Card>
              <Row style={{ justifyContent: "space-between" }}>
                <T bold style={{ color: t.accent }}>{p.metricType || "Entry"}</T>
                <T small muted>{longDate(p.date)}</T>
              </Row>
              {p.value && p.value !== "—" ? <T style={{ fontSize: 20, fontWeight: "700", marginTop: 2 }}>{p.value}</T> : null}
              {p.notes ? <T style={{ marginTop: 4 }}>{p.notes}</T> : null}
              {p.loggedBy ? <View style={{ marginTop: 4 }}><T small muted>Logged by {p.loggedBy}</T></View> : null}
            </Card>
          </Pressable>
        ))}
      </Section>
    </Screen>
  );
}

const RECENT = 3;

/** The athlete's recent practices; the rest are on the full history screen. */
function Workouts({ athlete }: { athlete: Athlete }) {
  const { data } = useAppState();
  if (!data) return null;
  const history = athleteHistory(data, athlete);
  const here = history.filter((h) => h.entry.here).length;
  return (
    <Section title={`Workouts (${here} practice${here === 1 ? "" : "s"})`}
      action={history.length ? <LinkButton label={history.length === 1 ? "See day" : `See all ${history.length} days`} onPress={() => router.push(`/workouts/${athlete.row}`)} /> : undefined}>
      {history.length === 0 ? <Empty>No workouts saved yet. Use "Save workout" at the bottom of Today after practice.</Empty> : (
        <>
          {history.length > here && <T small muted style={{ marginBottom: 8 }}>There for {here} of the last {history.length} saved practices.</T>}
          {history.slice(0, RECENT).map((h) => <AthleteDay key={h.entry.date} record={h} athlete={athlete} tierNames={data.settings.tierNames} />)}
        </>
      )}
    </Section>
  );
}
