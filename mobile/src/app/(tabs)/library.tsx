// Library — browse the Exercise Library by block type and tier, and add exercises.

import { router } from "expo-router";
import { useState } from "react";
import { useAppState } from "@/data/store";
import { ALL_LEVELS } from "@/core/schema/layout";
import { timesUsed } from "@/core/logic/library";
import { Button, Empty, FilterChips, ListRow, Screen, SearchBox, TierChip } from "@/ui/kit";

export default function LibraryList() {
  const { data } = useAppState();
  const [query, setQuery] = useState("");
  const [blockType, setBlockType] = useState("");
  const [tier, setTier] = useState("");
  if (!data) return null;
  const { library, settings, log } = data;

  const q = query.trim().toLowerCase();
  const visible = library
    .filter((e) => !blockType || e.blockType === blockType)
    // Picking a tier also shows "All Levels" exercises, since those suit every tier.
    .filter((e) => !tier || e.tier === tier || (tier !== ALL_LEVELS && e.tier === ALL_LEVELS))
    .filter((e) => !q || [e.name, e.description, e.equipment].some((s) => s.toLowerCase().includes(q)));
  const typesInUse = settings.blockTypes.filter((t) => library.some((e) => e.blockType === t));

  return (
    <Screen>
      <SearchBox value={query} onChange={setQuery} placeholder="Search exercises" />
      <FilterChips label="Block type" value={blockType} onChange={setBlockType}
        options={[{ value: "", label: "All types" }, ...typesInUse.map((t) => ({ value: t, label: t }))]} />
      <FilterChips label="Tier" value={tier} onChange={setTier} options={[
        { value: "", label: "All tiers" },
        ...settings.tierNames.filter(Boolean).map((t) => ({ value: t, label: t, tier: t })),
      ]} />
      {visible.length === 0 ? <Empty>No exercises match.</Empty> : visible.map((e) => {
        const used = timesUsed(log, e.name);
        return (
          <ListRow key={e.row} title={e.name} subtitle={`${e.blockType}${used ? ` · used ${used}×` : ""}`}
            right={<TierChip tier={e.tier} tierNames={settings.tierNames} />} onPress={() => router.push(`/exercise/${e.row}`)} />
        );
      })}
      <Button label="Add an exercise" icon="plus" style={{ marginTop: 12 }} onPress={() => router.push("/edit/exercise")} />
    </Screen>
  );
}
