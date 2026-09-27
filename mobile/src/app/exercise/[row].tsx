// One Exercise Library entry.

import { router, Stack, useLocalSearchParams } from "expo-router";
import { useAppState } from "@/data/store";
import { timesUsed } from "@/core/logic/library";
import { Card, Empty, Field, H2, IconButton, MutedChip, Row, Screen, TierChip } from "@/ui/kit";

export default function ExerciseDetail() {
  const { data } = useAppState();
  const { row } = useLocalSearchParams<{ row: string }>();
  const e = data?.library.find((x) => x.row === Number(row));
  if (!data) return null;
  if (!e) return <Screen><Empty>That exercise isn't in the library anymore.</Empty></Screen>;
  const used = timesUsed(data.log, e.name);

  return (
    <Screen>
      <Stack.Screen options={{
        title: e.name,
        headerRight: () => <IconButton icon="edit" label="Edit exercise" onPress={() => router.push({ pathname: "/edit/exercise", params: { row: String(e.row) } })} />,
      }} />
      <H2>{e.name}</H2>
      <Row style={{ marginTop: 6, marginBottom: 14 }}>
        {e.blockType ? <MutedChip label={e.blockType} /> : null}
        <TierChip tier={e.tier} tierNames={data.settings.tierNames} />
      </Row>
      <Card>
        <Field label="Description / instructions" value={e.description} />
        <Field label="Suggested sets × reps / duration" value={e.setsRepsDuration} />
        <Field label="Equipment" value={e.equipment} />
        <Field label="Notes / source" value={e.notesSource} />
        <Field label="Times used" value={used ? `${used} time${used === 1 ? "" : "s"} in the workout log` : "Not used in the workout log yet"} />
      </Card>
    </Screen>
  );
}
