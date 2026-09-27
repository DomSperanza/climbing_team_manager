import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
import { ALL_COACHES, ALL_LEVELS, ALL_TEAM } from "../schema/layout";

// ---- routing: "#/athletes/7?d=2026-09-24" -> { parts: ["athletes","7"], query } ----------

export interface Route { parts: string[]; query: URLSearchParams }

function readRoute(): Route {
  const [path, qs] = window.location.hash.replace(/^#\/?/, "").split("?");
  return { parts: path.split("/").filter(Boolean), query: new URLSearchParams(qs ?? "") };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const on = () => setRoute(readRoute());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

export function go(hash: string) {
  window.location.hash = hash;
}

// ---- tiers: color comes from the tier's *position* in Settings, never its name ----------

export function tierClass(tier: string, tierNames: string[]): string {
  if (tier === ALL_TEAM || tier === ALL_LEVELS || tier === ALL_COACHES) return "tier-all";
  const i = tierNames.indexOf(tier);
  return i >= 0 ? `tier-${i + 1}` : "tier-none";
}

export function TierChip({ tier, tierNames }: { tier: string; tierNames: string[] }) {
  if (!tier) return null;
  return <span class={`chip ${tierClass(tier, tierNames)}`}>{tier}</span>;
}

// ---- small building blocks --------------------------------------------------------------

export function Section({ title, children, action }: { title?: string; children: ComponentChildren; action?: ComponentChildren }) {
  return (
    <section class="section">
      {(title || action) && <div class="section-head">{title && <h2>{title}</h2>}{action}</div>}
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ComponentChildren }) {
  return <div class="empty">{children}</div>;
}

/** A label/value pair that renders nothing when the value is blank. */
export function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div class="field">
      <div class="field-label">{label}</div>
      <div class="field-value">{value}</div>
    </div>
  );
}

export function FilterChips<T extends string>({ options, value, onChange, label }: {
  options: { value: T; label: string; cls?: string }[]; value: T; onChange: (v: T) => void; label: string;
}) {
  return (
    <div class="filter-chips" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button type="button" role="radio" aria-checked={o.value === value}
          class={`filter-chip ${o.cls ?? ""} ${o.value === value ? "on" : ""}`} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SearchBox({ value, onInput, placeholder }: { value: string; onInput: (v: string) => void; placeholder: string }) {
  return (
    <input class="search" type="search" value={value} placeholder={placeholder} aria-label={placeholder}
      onInput={(e) => onInput((e.target as HTMLInputElement).value)} />
  );
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return <a class="back" href={href}><Icon name="back" /> {label}</a>;
}

// ---- icons (inline SVG, inherit currentColor) --------------------------------------------

const PATHS: Record<string, string> = {
  today: "M7 3v2M17 3v2M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm4 8h2v2H9z",
  schedule: "M4 6h16M4 12h16M4 18h10",
  athletes: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.5a3.5 3.5 0 0 1 0 6.5M21 20c0-2.6-1.6-4.8-4-5.6",
  library: "M5 4h4v16H5zM10 4h4v16h-4zM15.5 4.5l3.8-1 3.2 15.6-3.8 1z",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  refresh: "M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6",
  back: "M15 5l-7 7 7 7",
  prev: "M15 5l-7 7 7 7",
  next: "M9 5l7 7-7 7",
};

export function Icon({ name, size = 22 }: { name: keyof typeof PATHS | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={name === "more" ? 3.2 : 1.9}
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
