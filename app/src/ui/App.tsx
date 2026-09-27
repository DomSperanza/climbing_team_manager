import { refresh, signInAgain, useAppState } from "../data/store";
import { AthleteDetail, AthleteList } from "./Athletes";
import { Connect } from "./Connect";
import { LibraryDetail, LibraryList } from "./Library";
import { More } from "./More";
import { Schedule } from "./Schedule";
import { Today } from "./Today";
import { Icon, useRoute } from "./common";

const TABS = [
  { id: "today", label: "Today", title: "Today's plan" },
  { id: "schedule", label: "Schedule", title: "Season schedule" },
  { id: "athletes", label: "Athletes", title: "Athletes" },
  { id: "library", label: "Library", title: "Exercise library" },
  { id: "more", label: "More", title: "Coaches & settings" },
] as const;

export function App() {
  const s = useAppState();
  const route = useRoute();

  if (!s.ready) return <div class="splash" aria-busy="true" />;
  if (!s.source || !s.data) return <Connect />;

  const data = s.data;
  const tab = TABS.find((t) => t.id === route.parts[0]) ?? TABS[0];
  const detailRow = Number(route.parts[1]);

  let screen;
  switch (tab.id) {
    case "schedule": screen = <Schedule data={data} />; break;
    case "athletes": screen = detailRow ? <AthleteDetail data={data} row={detailRow} /> : <AthleteList data={data} />; break;
    case "library": screen = detailRow ? <LibraryDetail data={data} row={detailRow} /> : <LibraryList data={data} />; break;
    case "more": screen = <More data={data} />; break;
    default: screen = <Today data={data} route={route} />;
  }

  return (
    <div class="shell">
      <header class="topbar">
        <div class="topbar-text">
          <h1>{tab.title}</h1>
          <div class="topbar-sub">{s.source.kind === "demo" ? "Demo data" : s.source.title}</div>
        </div>
        <button type="button" class={`icon-btn ${s.loading ? "spinning" : ""}`} aria-label="Refresh from the Sheet"
          disabled={s.loading} onClick={() => (s.needsSignIn ? signInAgain() : refresh())}>
          <Icon name="refresh" />
        </button>
      </header>

      <StatusBanner />

      <main class="content" key={tab.id + (route.parts[1] ?? "")}>{screen}</main>

      <nav class="tabbar" aria-label="Sections">
        {TABS.map((t) => (
          <a key={t.id} href={`#/${t.id}`} class={t.id === tab.id ? "on" : ""} aria-current={t.id === tab.id ? "page" : undefined}>
            <Icon name={t.id} />
            <span>{t.label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}

function StatusBanner() {
  const s = useAppState();
  const when = s.fetchedAt ? new Date(s.fetchedAt).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" }) : "";
  if (!s.online) return <div class="banner">Offline — showing data saved {when}.</div>;
  if (s.needsSignIn) {
    return (
      <div class="banner">
        {s.error && s.error !== "Your Google sign-in has expired." ? s.error + " " : ""}Showing data saved {when}.{" "}
        <button type="button" class="link-btn" onClick={signInAgain}>Sign in to refresh</button>
      </div>
    );
  }
  if (s.error) return <div class="banner error" role="alert">{s.error}</div>;
  return null;
}
