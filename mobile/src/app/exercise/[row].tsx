// One Exercise Library entry, and who added it (so coaches know who to ask about it).

import { router, Stack, useLocalSearchParams } from "expo-router";
import { Linking, View } from "react-native";
import { useAppState } from "@/data/store";
import { timesUsed } from "@/core/logic/library";
import { Card, Empty, Field, H2, IconButton, LinkButton, MutedChip, Row, Screen, T, TierChip } from "@/ui/kit";

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
      <AddedBy name={e.addedBy} />
    </Screen>
  );
}

/** Who put the exercise in the library, with a quick way to reach them with questions. */
function AddedBy({ name }: { name: string }) {
  const { data } = useAppState();
  const coach = name ? data?.coaches.find((c) => c.fullName.toLowerCase() === name.toLowerCase()) : undefined;
  return (
    <Card>
      <T small muted>Added by</T>
      <T bold>{name || "Not recorded"}</T>
      {!name && <T small muted>Tap the pencil to add who put this in, so coaches know who to ask.</T>}
      {coach && (coach.email || coach.phone) ? (
        <View style={{ marginTop: 6, gap: 6 }}>
          <T small muted>Questions about it? Ask {coach.firstName}:</T>
          {coach.email ? <LinkButton label={coach.email} onPress={() => Linking.openURL(`mailto:${coach.email}?subject=${encodeURIComponent("Exercise question")}`)} /> : null}
          {coach.phone ? <LinkButton label={coach.phone} onPress={() => Linking.openURL(`sms:${coach.phone.replace(/[^\d+]/g, "")}`)} /> : null}
        </View>
      ) : null}
    </Card>
  );
}
