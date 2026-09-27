// Schedule — the season's rotation (Rotation Schedule + Full Team Calendar in one list).

import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { useAppState } from "@/data/store";
import { formatShort, thursdayOfWeek, todayISO, weekdayOf } from "@/core/logic/dates";
import { coachesFor, seasonWeeks, weekNumberFor } from "@/core/logic/rotation";
import { Banner, Button, Card, Empty, Row, Screen, T, TierChip } from "@/ui/kit";
import { tierColors, useTheme } from "@/ui/theme";

export default function Schedule() {
  const t = useTheme();
  const { data } = useAppState();
  const currentWeek = data ? weekNumberFor(data.settings, todayISO()) : null;
  const [count, setCount] = useState(() => Math.max(data?.settings.numberOfWeeks ?? 16, (currentWeek ?? 0) + 4));
  if (!data) return null;
  const { settings, coaches } = data;

  if (!settings.seasonStartDate) {
    return <Screen><Empty>No season start date is set. Add one on the Sheet's Settings tab (cell B16).</Empty></Screen>;
  }

  const weeks = seasonWeeks(settings, coaches, count);
  const warnings: string[] = [];
  if (weekdayOf(settings.seasonStartDate) !== "Thursday") {
    warnings.push(`The season start date (${formatShort(settings.seasonStartDate)}) isn't a Thursday — weeks are counted from the Thursday of that week (${formatShort(thursdayOfWeek(settings.seasonStartDate))}).`);
  }
  if (!coachesFor(coaches, "Thursday").length) warnings.push("No active coach is marked for Thursday yet.");

  return (
    <Screen>
      {warnings.map((w) => <View key={w} style={{ marginHorizontal: -16, marginBottom: 10 }}><Banner>{w}</Banner></View>)}
      <T small muted style={{ marginBottom: 10 }}>Tap a week to see that Thursday's plan.</T>
      {weeks.map((w) => {
        const isCurrent = w.week === currentWeek;
        const c = tierColors(t, w.featuredTier, settings.tierNames);
        return (
          <Pressable key={w.week} accessibilityRole="button" onPress={() => router.navigate({ pathname: "/", params: { d: w.thursday } })}>
            {({ pressed }) => (
              <Card tint={c.fg} style={[{ opacity: pressed ? 0.75 : w.week > settings.numberOfWeeks ? 0.7 : 1 }, isCurrent && { borderColor: t.accent, borderWidth: 2 }]}>
                <Row style={{ justifyContent: "space-between" }}>
                  <T small bold style={{ color: isCurrent ? t.accent : t.muted }}>Week {w.week}{isCurrent ? " · this week" : ""}</T>
                  <T small muted>Thu {formatShort(w.thursday)}</T>
                </Row>
                <Row style={{ marginTop: 6 }}>
                  <TierChip tier={w.featuredTier} tierNames={settings.tierNames} />
                  <T bold style={{ flex: 1 }} numberOfLines={1}>{w.thursdayLead ?? "— no Thursday coach —"}</T>
                </Row>
                <T small muted style={{ marginTop: 4 }}>Mon: {w.mondayLead ?? "—"} · Tue: {w.tuesdayLead ?? "—"}</T>
              </Card>
            )}
          </Pressable>
        );
      })}
      <Button label="Show 4 more weeks" onPress={() => setCount(count + 4)} />
      {count > settings.numberOfWeeks && (
        <T small muted style={{ marginTop: 8 }}>Weeks past {settings.numberOfWeeks} (the season length on the Sheet's Settings tab) continue the same rotation.</T>
      )}
    </Screen>
  );
}
