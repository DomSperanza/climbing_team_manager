// Library — browse the Exercise Library by block type and tier.

import { useState } from "preact/hooks";
import type { TeamData } from "../schema/model";
import { ALL_LEVELS } from "../schema/layout";
import { timesUsed } from "../logic/library";
import { BackLink, Empty, Field, FilterChips, SearchBox, TierChip, tierClass } from "./common";

export function LibraryList({ data }: { data: TeamData }) {
  const { library, settings, log } = data;
  const [query, setQuery] = useState("");
  const [blockType, setBlockType] = useState("");
  const [tier, setTier] = useState("");

  const q = query.trim().toLowerCase();
  const visible = library
    .filter((e) => !blockType || e.blockType === blockType)
    // Picking a tier also shows "All Levels" exercises, since those suit every tier.
    .filter((e) => !tier || e.tier === tier || (tier !== ALL_LEVELS && e.tier === ALL_LEVELS))
    .filter((e) => !q || [e.name, e.description, e.equipment].some((s) => s.toLowerCase().includes(q)));
  const typesInUse = settings.blockTypes.filter((t) => library.some((e) => e.blockType === t));

  return (
    <div>
      <SearchBox value={query} onInput={setQuery} placeholder="Search exercises" />
      <FilterChips label="Block type" value={blockType} onChange={setBlockType}
        options={[{ value: "", label: "All types" }, ...typesInUse.map((t) => ({ value: t, label: t }))]} />
      <FilterChips label="Tier" value={tier} onChange={setTier} options={[
        { value: "", label: "All tiers" },
        ...settings.tierNames.filter(Boolean).map((t) => ({ value: t, label: t, cls: tierClass(t, settings.tierNames) })),
      ]} />
      {visible.length === 0 ? <Empty>No exercises match.</Empty> : (
        <ul class="list">
          {visible.map((e) => {
            const used = timesUsed(log, e.name);
            return (
              <li key={e.row}>
                <a class="list-row" href={`#/library/${e.row}`}>
                  <div class="list-main">
                    <div class="list-title">{e.name}</div>
                    <div class="list-sub">{e.blockType}{used ? ` · used ${used}×` : ""}</div>
                  </div>
                  <TierChip tier={e.tier} tierNames={settings.tierNames} />
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function LibraryDetail({ data, row }: { data: TeamData; row: number }) {
  const e = data.library.find((x) => x.row === row);
  if (!e) return <div><BackLink href="#/library" label="Library" /><Empty>That exercise isn't in the library anymore.</Empty></div>;
  const used = timesUsed(data.log, e.name);
  return (
    <div>
      <BackLink href="#/library" label="Library" />
      <div class="profile-head">
        <h2>{e.name}</h2>
        <div class="profile-chips">
          <span class="chip tier-none">{e.blockType}</span>
          <TierChip tier={e.tier} tierNames={data.settings.tierNames} />
        </div>
      </div>
      <div class="card">
        <Field label="Description / instructions" value={e.description} />
        <Field label="Suggested sets × reps / duration" value={e.setsRepsDuration} />
        <Field label="Equipment" value={e.equipment} />
        <Field label="Notes / source" value={e.notesSource} />
        <Field label="Times used" value={used ? `${used} time${used === 1 ? "" : "s"} in the workout log` : "Not used in the workout log yet"} />
      </div>
    </div>
  );
}
