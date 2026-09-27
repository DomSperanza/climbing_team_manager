// First-run screen: connect the team's Google Sheet, or try the demo.

import { useState } from "preact/hooks";
import { spreadsheetIdFrom } from "../config";
import { isAuthConfigured } from "../google/auth";
import { connectSheet, startDemo, useAppState } from "../data/store";

export function Connect() {
  const s = useAppState();
  // Keep the link filled in after a round trip to Google sign-in, so a failed connect can be retried.
  const [link, setLink] = useState(s.connectingTo ? `https://docs.google.com/spreadsheets/d/${s.connectingTo}/edit` : "");
  const [localError, setLocalError] = useState("");
  const configured = isAuthConfigured();

  const submit = (e: Event) => {
    e.preventDefault();
    const id = spreadsheetIdFrom(link);
    if (!id) { setLocalError("That doesn't look like a Google Sheets link. Open the Sheet, copy the address from the browser, and paste it here."); return; }
    setLocalError("");
    connectSheet(id);
  };

  return (
    <div class="connect">
      <div class="brand">
        <img src="./icon.svg" alt="" width="72" height="72" />
        <h1>Rock Team</h1>
        <p class="muted">Practice plans, rotation, roster and exercise library — from the team's Google Sheet.</p>
      </div>

      <form class="card" onSubmit={submit}>
        <label for="sheet-link"><strong>Connect the team Sheet</strong></label>
        <p class="muted small">Paste the link to the Rock Team Google Sheet. You'll sign in with the Google account the Sheet is shared with.</p>
        <input id="sheet-link" type="url" inputMode="url" autoComplete="off" placeholder="https://docs.google.com/spreadsheets/d/…"
          value={link} onInput={(e) => setLink((e.target as HTMLInputElement).value)} disabled={!configured} />
        <button type="submit" class="btn primary wide" disabled={!configured || s.loading || !link.trim()}>
          {s.loading ? "Connecting…" : "Sign in with Google & connect"}
        </button>
        {!configured && <p class="small warn-text">Google sign-in isn't set up for this copy of the app yet (see app/README.md). The demo works without it.</p>}
        {(localError || s.error) && <p class="small error-text" role="alert">{localError || s.error}</p>}
      </form>

      <div class="or">or</div>
      <button type="button" class="btn wide" onClick={() => startDemo()}>Try it with demo data</button>
    </div>
  );
}
