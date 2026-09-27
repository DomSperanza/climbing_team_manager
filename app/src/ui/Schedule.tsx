// Schedule — the season's rotation (Rotation Schedule + Full Team Calendar in one list).

import { useEffect, useRef, useState } from "preact/hooks";
import type { TeamData } from "../schema/model";
import { formatShort, thursdayOfWeek, todayISO, weekdayOf } from "../logic/dates";
import { coachesFor, seasonWeeks, weekNumberFor } from "../logic/rotation";
import { Empty, TierChip, go, tierClass } from "./common";

export function Schedule({ data }: { data: TeamData }) {
  const { settings, coaches } = data;
  const currentWeek = weekNumberFor(settings, todayISO());
  const [count, setCount] = useState(() => Math.max(settings.numberOfWeeks, (currentWeek ?? 0) + 4));
  const weeks = seasonWeeks(settings, coaches, count);
  const currentRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { currentRef.current?.scrollIntoView({ block: "center" }); }, []);

  if (!settings.seasonStartDate) {
    return <Empty>No season start date is set. Add one on the Sheet's Settings tab (cell B16).</Empty>;
  }

  const warnings: string[] = [];
  if (weekdayOf(settings.seasonStartDate) !== "Thursday") {
    warnings.push(`The season start date (${formatShort(settings.seasonStartDate)}) isn't a Thursday — weeks are counted from the Thursday of that week (${formatShort(thursdayOfWeek(settings.seasonStartDate))}).`);
  }
  if (!coachesFor(coaches, "Thursday").length) warnings.push("No active coach is marked for Thursday yet.");

  return (
    <div class="schedule">
      {warnings.map((w) => <div class="banner warn" key={w}>{w}</div>)}
      <p class="hint">Tap a week to see that Thursday's plan.</p>
      <ol class="weeks">
        {weeks.map((w) => {
          const isCurrent = w.week === currentWeek;
          return (
            <li key={w.week}>
              <button type="button" ref={isCurrent ? currentRef : undefined}
                class={`week card ${tierClass(w.featuredTier, settings.tierNames)} ${isCurrent ? "current" : ""} ${w.week > settings.numberOfWeeks ? "beyond" : ""}`}
                onClick={() => go(`#/today?d=${w.thursday}`)}>
                <div class="week-head">
                  <span class="week-num">Week {w.week}{isCurrent ? " · this week" : ""}</span>
                  <span class="week-date">Thu {formatShort(w.thursday)}</span>
                </div>
                <div class="week-main">
                  <TierChip tier={w.featuredTier} tierNames={settings.tierNames} />
                  <span class="week-lead">{w.thursdayLead ?? "— no Thursday coach —"}</span>
                </div>
                <div class="week-sub">Mon: {w.mondayLead ?? "—"} · Tue: {w.tuesdayLead ?? "—"}</div>
              </button>
            </li>
          );
        })}
      </ol>
      <button type="button" class="btn wide" onClick={() => setCount(count + 4)}>Show 4 more weeks</button>
      {count > settings.numberOfWeeks && (
        <p class="hint">Weeks past {settings.numberOfWeeks} (the season length on the Sheet's Settings tab) continue the same rotation.</p>
      )}
    </div>
  );
}
