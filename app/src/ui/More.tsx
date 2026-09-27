// More — coaches, the connected Sheet, and sign-out.

import { useState } from "preact/hooks";
import type { Coach, TeamData } from "../schema/model";
import { disconnect, refresh, useAppState } from "../data/store";
import { Section } from "./common";

function days(c: Coach): string[] {
  return [c.coachesMonday && "Mon", c.coachesTuesday && "Tue", c.coachesThursday && "Thu"].filter(Boolean) as string[];
}

export function More({ data }: { data: TeamData }) {
  const s = useAppState();
  const [open, setOpen] = useState<number | null>(null);
  const coaches = [...data.coaches].sort((a, b) => (a.status === b.status ? a.row - b.row : a.status === "Active" ? -1 : 1));

  return (
    <div>
      <Section title="Coaches">
        <ul class="list">
          {coaches.map((c) => (
            <li key={c.row}>
              <button type="button" class={`list-row ${c.status === "Inactive" ? "inactive" : ""}`} aria-expanded={open === c.row}
                onClick={() => setOpen(open === c.row ? null : c.row)}>
                <div class="list-main">
                  <div class="list-title">{c.fullName}</div>
                  <div class="list-sub">{c.role}{c.status === "Inactive" ? " · Inactive" : ""}</div>
                </div>
                <div class="day-pills">{days(c).map((d) => <span class="pill" key={d}>{d}</span>)}</div>
              </button>
              {open === c.row && (
                <div class="coach-detail">
                  {c.email && <a href={`mailto:${c.email}`}>{c.email}</a>}
                  {c.phone && <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}>{c.phone}</a>}
                  {c.otherDays && <div><span class="muted">Other days:</span> {c.otherDays}</div>}
                  {c.specialties && <div><span class="muted">Specialties:</span> {c.specialties}</div>}
                  {c.bio && <p>{c.bio}</p>}
                </div>
              )}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Data">
        <div class="card">
          {s.source?.kind === "demo" ? (
            <p>You're looking at <strong>demo data</strong> built from the example workbook. Nothing here is connected to a real Sheet.</p>
          ) : s.source?.kind === "sheet" ? (
            <>
              <p>Connected to <strong>{s.source.title}</strong>.</p>
              <p><a href={`https://docs.google.com/spreadsheets/d/${s.source.spreadsheetId}/edit`} target="_blank" rel="noopener">Open the Sheet in Google Sheets</a></p>
            </>
          ) : null}
          {s.fetchedAt && <p class="muted small">Last updated {new Date(s.fetchedAt).toLocaleString()}</p>}
          <div class="btn-row">
            <button type="button" class="btn" disabled={s.loading} onClick={() => refresh()}>Refresh now</button>
            <button type="button" class="btn danger" onClick={() => {
              if (confirm("Sign out and remove all team data saved on this device?")) disconnect().then(() => { window.location.hash = "#/today"; });
            }}>{s.source?.kind === "demo" ? "Leave demo" : "Sign out & clear data"}</button>
          </div>
        </div>
      </Section>

      <Section title="About">
        <p class="muted small">
          Rock Team — read-only preview. Everything shown comes from the team's Google Sheet; edit the Sheet to change it.
          This app only keeps a copy on this device so it opens instantly and works without signal.
        </p>
      </Section>
    </div>
  );
}
