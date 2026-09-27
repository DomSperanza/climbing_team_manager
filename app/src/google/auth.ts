// Google sign-in with the OAuth 2.0 client-side ("implicit", response_type=token) flow.
// No server and no client secret: Google redirects back to this page with an access token
// in the URL fragment. A full-page redirect (not a popup) because popups are unreliable in
// iOS home-screen apps.
//
// The token lives in sessionStorage only and expires after ~1 hour; when it's gone the app
// keeps showing cached data and asks the coach to sign in again before the next refresh.

import { GOOGLE_CLIENT_ID, GOOGLE_SCOPES } from "../config";

const TOKEN_KEY = "rt.token";
const STATE_KEY = "rt.oauthState";
const RETURN_KEY = "rt.returnTo";

interface StoredToken { accessToken: string; expiresAt: number }

function session(): Storage | null {
  try { return window.sessionStorage; } catch { return null; }
}

export function isAuthConfigured(): boolean {
  return GOOGLE_CLIENT_ID.length > 0;
}

function redirectUri(): string {
  return window.location.origin + window.location.pathname;
}

/** Leaves the app for Google's sign-in page. `returnTo` is the hash route to come back to. */
export function signIn(returnTo: string = window.location.hash): void {
  const state = crypto.getRandomValues(new Uint32Array(4)).join("-");
  session()?.setItem(STATE_KEY, state);
  session()?.setItem(RETURN_KEY, returnTo);
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: "token",
    scope: GOOGLE_SCOPES,
    include_granted_scopes: "true",
    state,
  });
  window.location.assign("https://accounts.google.com/o/oauth2/v2/auth?" + params);
}

/**
 * Call once at startup, before routing: if we're coming back from Google, keep the token,
 * restore the route the coach was on, and scrub the token out of the address bar.
 * Returns an error message if Google reported one (e.g. the coach pressed Cancel).
 */
export function completeSignInFromUrl(): { returned: boolean; error?: string } {
  const hash = window.location.hash.slice(1);
  if (!/(^|&)(access_token|error)=/.test(hash)) return { returned: false };
  const p = new URLSearchParams(hash);
  const expected = session()?.getItem(STATE_KEY);
  const returnTo = session()?.getItem(RETURN_KEY) || "#/today";
  session()?.removeItem(STATE_KEY);
  session()?.removeItem(RETURN_KEY);
  history.replaceState(null, "", window.location.pathname + window.location.search + returnTo);

  if (p.get("error")) {
    return { returned: true, error: p.get("error") === "access_denied" ? "Sign-in was cancelled." : "Google sign-in failed: " + p.get("error") };
  }
  if (!expected || p.get("state") !== expected) {
    return { returned: true, error: "Sign-in response didn't match this app — please try again." };
  }
  const token: StoredToken = {
    accessToken: p.get("access_token")!,
    // Treat it as expired a minute early so a request never goes out with a dying token.
    expiresAt: Date.now() + (Number(p.get("expires_in")) || 3600) * 1000 - 60_000,
  };
  session()?.setItem(TOKEN_KEY, JSON.stringify(token));
  return { returned: true };
}

export function accessToken(): string | null {
  try {
    const t = JSON.parse(session()?.getItem(TOKEN_KEY) ?? "null") as StoredToken | null;
    return t && t.expiresAt > Date.now() ? t.accessToken : null;
  } catch {
    return null;
  }
}

export function forgetToken(): void {
  const token = accessToken();
  session()?.removeItem(TOKEN_KEY);
  // Best effort: also revoke it on Google's side.
  if (token) fetch("https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(token), { method: "POST" }).catch(() => {});
}
