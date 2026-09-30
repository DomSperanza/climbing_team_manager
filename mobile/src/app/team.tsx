// More → Team settings: the team's groups (add, rename, reorder, remove), practice days and
// practice time. Saved to the Sheet's Settings tab; a renamed group is renamed everywhere.

import { Stack } from "expo-router";
import { useState } from "react";
import { saveTeamSettings, useAppState } from "@/data/store";
import { renames, setupFromSettings, type TeamSetup } from "@/core/teamSettings";
import { FormScreen, notify } from "@/ui/form";
import { TeamSetupFields } from "@/ui/TeamSetupFields";

export default function TeamSettings() {
  const { data } = useAppState();
  const [v, setV] = useState<TeamSetup | null>(() => (data ? setupFromSettings(data.settings) : null));
  if (!data || !v) return null;
  const renaming = renames(v).size > 0;

  return (
    <FormScreen
      note={renaming ? "Renamed groups are renamed everywhere: athletes, exercises, workout plans and attendance." : undefined}
      onSave={async () => {
        const r = await saveTeamSettings(v);
        if (!r.sheetTidied) {
          notify("Saved", "The app has your changes. The Sheet's own dropdowns and colors couldn't be updated this time; they'll catch up the next time Team settings is saved.");
        }
      }}>
      <Stack.Screen options={{ title: "Team settings" }} />
      <TeamSetupFields value={v} onChange={setV} athletes={data.athletes} />
    </FormScreen>
  );
}
