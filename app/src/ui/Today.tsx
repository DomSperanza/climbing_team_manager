// Today — the phone replacement for the Sheet's Day View: one practice day's plan, top to bottom.

import type { TeamData, WorkoutBlock } from "../schema/model";
import { daysBetween, formatLong, nextPracticeDay, stepPracticeDay, todayISO, type ISODate } from "../logic/dates";
import { practiceInfo } from "../logic/rotation";
import { Empty, Icon, TierChip, go, tierClass, type Route } from "./common";

function nearestPlannedDay(log: WorkoutBlock[], d: ISODate): ISODate | null {
  let best: ISODate | null = null;
  for (const b of log) {
    if (!best || Math.abs(daysBetween(d, b.date)) < Math.abs(daysBetween(d, best))) best = b.date;
  }
  return best;
}

/** Blocks for the day, grouped by group in the order each group first appears in the log. */
function groupBlocks(blocks: WorkoutBlock[]): [string, WorkoutBlock[]][] {
  const groups = new Map<string, WorkoutBlock[]>();
  for (const b of blocks) {
    const g = b.group || "Unassigned";
    groups.set(g, [...(groups.get(g) ?? []), b]);
  }
  return [...groups];
}

export function Today({ data, route }: { data: TeamData; route: Route }) {
  const today = todayISO();
  const requested = route.query.get("d");
  const date = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : nextPracticeDay(today);
  const show = (d: ISODate) => go(`#/today?d=${d}`);

  const { settings, coaches, log } = data;
  const info = practiceInfo(settings, coaches, date);
  const blocks = log.filter((b) => b.date === date);
  const groups = groupBlocks(blocks);
  const nearest = blocks.length ? null : nearestPlannedDay(log, date);

  return (
    <div class="today">
      <div class="day-nav">
        <button type="button" class="icon-btn" aria-label="Previous practice" onClick={() => show(stepPracticeDay(date, -1))}><Icon name="prev" /></button>
        <label class="day-title">
          <span>{formatLong(date)}</span>
          <input type="date" value={date} aria-label="Pick a date" onChange={(e) => { const v = (e.target as HTMLInputElement).value; if (v) show(v); }} />
        </label>
        <button type="button" class="icon-btn" aria-label="Next practice" onClick={() => show(stepPracticeDay(date, 1))}><Icon name="next" /></button>
      </div>
      {date !== nextPracticeDay(today) && (
        <button type="button" class="link-btn center" onClick={() => go("#/today")}>Jump to the next practice</button>
      )}

      <div class={`day-summary ${info.featuredTier ? tierClass(info.featuredTier, settings.tierNames) : ""}`}>
        {info.week === null ? (
          <div>Before the season starts{settings.seasonStartDate ? ` (${formatLong(settings.seasonStartDate)})` : ""}.</div>
        ) : (
          <>
            <div class="summary-row">
              <span class="summary-label">{info.day === "Thursday" ? "Lead coach" : "Coach on duty"}</span>
              <span class="summary-value">{info.lead ?? `— add a ${info.day} coach —`}</span>
            </div>
            {info.featuredTier && (
              <div class="summary-row">
                <span class="summary-label">Featured tier</span>
                <TierChip tier={info.featuredTier} tierNames={settings.tierNames} />
              </div>
            )}
            <div class="summary-meta">Week {info.week}{info.day === "Thursday" ? ` · cycle week ${((info.week - 1) % 4) + 1} of 4` : ""}</div>
          </>
        )}
      </div>

      {blocks.length === 0 ? (
        <Empty>
          <p>Nothing planned for this day yet.</p>
          {nearest && <button type="button" class="btn" onClick={() => show(nearest)}>Go to the nearest planned day ({formatLong(nearest)})</button>}
        </Empty>
      ) : (
        <>
          <div class="count">{blocks.length} block{blocks.length === 1 ? "" : "s"} planned</div>
          {groups.map(([group, items]) => (
            <div class="block-group" key={group}>
              {groups.length > 1 && <h3 class="group-head"><TierChip tier={group} tierNames={settings.tierNames} /></h3>}
              {items.map((b) => <BlockCard key={b.row} block={b} tierNames={settings.tierNames} showTier={groups.length === 1} />)}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function BlockCard({ block: b, tierNames, showTier }: { block: WorkoutBlock; tierNames: string[]; showTier: boolean }) {
  const title = b.libraryItem || b.blockType || "Block";
  return (
    <article class={`card block ${tierClass(b.group, tierNames)}`}>
      <div class="block-head">
        <h3>{title}</h3>
        {showTier && <TierChip tier={b.group} tierNames={tierNames} />}
      </div>
      {b.libraryItem && b.blockType && <div class="block-type">{b.blockType}</div>}
      {b.description && <p class="block-desc">{b.description}</p>}
      {(b.setsRepsDuration || b.coach) && (
        <div class="block-meta">
          {b.setsRepsDuration && <span>{b.setsRepsDuration}</span>}
          {b.coach && <span>Coach: {b.coach}</span>}
        </div>
      )}
      {b.notes && <p class="block-notes">{b.notes}</p>}
    </article>
  );
}
