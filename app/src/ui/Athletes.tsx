// Athletes — roster browse/search, and one athlete's profile with their Progress Log.

import { useState } from "preact/hooks";
import type { TeamData } from "../schema/model";
import { formatShort } from "../logic/dates";
import { BackLink, Empty, Field, FilterChips, SearchBox, Section, TierChip, tierClass } from "./common";

export function AthleteList({ data }: { data: TeamData }) {
  const { athletes, settings } = data;
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const q = query.trim().toLowerCase();
  const visible = athletes
    .filter((a) => showInactive || a.status === "Active")
    .filter((a) => !tier || a.tier === tier)
    .filter((a) => !q || a.fullName.toLowerCase().includes(q))
    .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
  const active = athletes.filter((a) => a.status === "Active");
  const inactiveCount = athletes.length - active.length;

  return (
    <div>
      <SearchBox value={query} onInput={setQuery} placeholder="Search athletes" />
      <FilterChips label="Tier" value={tier} onChange={setTier} options={[
        { value: "", label: `All ${active.length}` },
        ...settings.tierNames.filter(Boolean).map((t) => ({
          value: t, label: `${t} ${active.filter((a) => a.tier === t).length}`, cls: tierClass(t, settings.tierNames),
        })),
      ]} />
      {inactiveCount > 0 && (
        <label class="toggle"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive((e.target as HTMLInputElement).checked)} /> Show {inactiveCount} inactive</label>
      )}
      {visible.length === 0 ? <Empty>No athletes match.</Empty> : (
        <ul class="list">
          {visible.map((a) => (
            <li key={a.row}>
              <a class={`list-row ${a.status === "Inactive" ? "inactive" : ""}`} href={`#/athletes/${a.row}`}>
                <div class="list-main">
                  <div class="list-title">{a.fullName}</div>
                  {(a.currentFlashGrade || a.goalGrade) && (
                    <div class="list-sub">Flash {a.currentFlashGrade || "—"}{a.goalGrade ? ` → goal ${a.goalGrade}` : ""}</div>
                  )}
                </div>
                {a.status === "Inactive" ? <span class="chip tier-none">Inactive</span> : <TierChip tier={a.tier} tierNames={settings.tierNames} />}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AthleteDetail({ data, row }: { data: TeamData; row: number }) {
  const a = data.athletes.find((x) => x.row === row);
  if (!a) return <div><BackLink href="#/athletes" label="Athletes" /><Empty>That athlete isn't on the roster anymore.</Empty></div>;

  // Progress Log links to athletes by full name (see HANDOFF.md) — a rename breaks the link.
  const entries = data.progress
    .filter((p) => p.athleteFullName.toLowerCase() === a.fullName.toLowerCase())
    .sort((x, y) => (y.date ?? "").localeCompare(x.date ?? ""));

  return (
    <div>
      <BackLink href="#/athletes" label="Athletes" />
      <div class="profile-head">
        <h2>{a.fullName}</h2>
        <div class="profile-chips">
          <TierChip tier={a.tier} tierNames={data.settings.tierNames} />
          {a.status === "Inactive" && <span class="chip tier-none">Inactive</span>}
        </div>
      </div>
      <div class="grades">
        <div><div class="grade">{a.currentFlashGrade || "—"}</div><div class="grade-label">Flash grade</div></div>
        <div><div class="grade">{a.goalGrade || "—"}</div><div class="grade-label">Goal</div></div>
      </div>
      <div class="card">
        <Field label="Current focus / goal" value={a.currentFocus} />
        <Field label="Strengths" value={a.strengths} />
        <Field label="Growth areas" value={a.growthAreas} />
        <Field label="Notes" value={a.notes} />
        <Field label="Joined" value={a.joinDate ? formatShort(a.joinDate) + ", " + a.joinDate.slice(0, 4) : ""} />
      </div>
      <Section title={`Progress (${entries.length})`}>
        {entries.length === 0 ? <Empty>No progress entries yet.</Empty> : (
          <ul class="timeline">
            {entries.map((p) => (
              <li key={p.row} class="card">
                <div class="timeline-head">
                  <span class="metric">{p.metricType || "Entry"}</span>
                  <span class="muted">{p.date ? formatShort(p.date) + ", " + p.date.slice(0, 4) : ""}</span>
                </div>
                {p.value && p.value !== "—" && <div class="metric-value">{p.value}</div>}
                {p.notes && <p>{p.notes}</p>}
                {p.loggedBy && <div class="muted small">Logged by {p.loggedBy}</div>}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
