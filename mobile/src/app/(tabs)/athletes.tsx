// Athletes — roster browse/search, and adding a new athlete.

import { router } from "expo-router";
import { useState } from "react";
import { useAppState } from "@/data/store";
import { Button, Empty, FilterChips, ListRow, MutedChip, Screen, SearchBox, TierChip } from "@/ui/kit";
import { SwitchField } from "@/ui/form";

export default function AthleteList() {
  const { data } = useAppState();
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  if (!data) return null;
  const { athletes, settings } = data;

  const q = query.trim().toLowerCase();
  const visible = athletes
    .filter((a) => showInactive || a.status === "Active")
    .filter((a) => !tier || a.tier === tier)
    .filter((a) => !q || a.fullName.toLowerCase().includes(q))
    .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
  const active = athletes.filter((a) => a.status === "Active");
  const inactiveCount = athletes.length - active.length;

  return (
    <Screen>
      <SearchBox value={query} onChange={setQuery} placeholder="Search athletes" />
      <FilterChips label="Tier" value={tier} onChange={setTier} options={[
        { value: "", label: `All ${active.length}` },
        ...settings.tierNames.filter(Boolean).map((t) => ({ value: t, label: `${t} ${active.filter((a) => a.tier === t).length}`, tier: t })),
      ]} />
      {inactiveCount > 0 && <SwitchField label={`Show ${inactiveCount} inactive`} value={showInactive} onChange={setShowInactive} />}
      {visible.length === 0 ? <Empty>No athletes match.</Empty> : visible.map((a) => (
        <ListRow key={a.row} title={a.fullName} dim={a.status === "Inactive"}
          subtitle={a.currentFlashGrade || a.goalGrade ? `Flash ${a.currentFlashGrade || "—"}${a.goalGrade ? ` → goal ${a.goalGrade}` : ""}` : undefined}
          right={a.status === "Inactive" ? <MutedChip label="Inactive" /> : <TierChip tier={a.tier} tierNames={settings.tierNames} />}
          onPress={() => router.push(`/athlete/${a.row}`)} />
      ))}
      <Button label="Add an athlete" icon="plus" style={{ marginTop: 12 }} onPress={() => router.push("/edit/athlete")} />
    </Screen>
  );
}
