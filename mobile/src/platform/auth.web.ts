// Google sign-in for the web version: the OAuth 2.0 client-side ("implicit",
// response_type=token) flow. No server and no client secret: Google redirects back to the
// app with an access token in the URL fragment. A full-page redirect (not a popup) because
// popups are unreliable in iOS home-screen web apps.
//
// The token lives in sessionStorage only and expires after ~1 hour; after that the app keeps
// showing saved data and asks the coach to sign in again before the next refresh or save.

import { GOOGLE_SCOPES } from "@/core/config";
import { sheetFromAppLink } from "@/core/recentSheets";

const CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";
const TOKEN_KEY = "rt.token";
const STATE_KEY = "rt.oauthState";
const RETURN_KEY = "rt.returnTo";
const PENDING_KEY = "rt.pending";
const SILENT_TRIED_KEY = "rt.silentTried"; // one quiet renewal per visit, so it can never loop
const SILENT_PENDING_KEY = "rt.silentPending";

export type SignInResult = { status: "ok" } | { status: "cancelled" } | { status: "error"; message: string } | { status: "redirecting" };

interface StoredToken { accessToken: string; expiresAt: number }

function session(): Storage | null {
  try { return window.sessionStorage; } catch { return null; }
}

export function isAuthConfigured(): boolean {
  return CLIENT_ID.length > 0;
}

/** The app's own address (e.g. https://you.github.io/rock-team/) — must be listed in the OAuth client. */
function redirectUri(): string {
  const base = (process.env.EXPO_BASE_URL ?? "").replace(/\/?$/, "/");
  return window.location.origin + base;
}

/** Leaves the app for Google's sign-in page; the page reloads on return. */
export async function signIn(): Promise<SignInResult> {
  if (!isAuthConfigured()) return { status: "error", message: "Google sign-in isn't set up for this copy of the app (see mobile/README.md)." };
  redirectToGoogle();
  return { status: "redirecting" };
}

/**
 * Renews an expired sign-in without showing anything: a quick round trip to Google with
 * prompt=none, which comes straight back with a new token when the coach is still signed in
 * to Google and has approved the app before. Tried once per visit. Returns true if leaving.
 */
export function trySilentSignIn(): boolean {
  if (!isAuthConfigured() || typeof navigator === "undefined" || !navigator.onLine) return false;
  if (session()?.getItem(SILENT_TRIED_KEY)) return false;
  session()?.setItem(SILENT_TRIED_KEY, "1");
  session()?.setItem(SILENT_PENDING_KEY, "1");
  redirectToGoogle({ prompt: "none" });
  return true;
}

/** The Sheet an invite link points at (…/?sheet=ID), taken out of the address bar. */
export function takeLinkedSheet(): string | null {
  if (typeof window === "undefined") return null;
  const id = sheetFromAppLink(window.location.search);
  if (id) {
    const params = new URLSearchParams(window.location.search);
    params.delete("sheet");
    const rest = params.toString();
    history.replaceState(null, "", window.location.pathname + (rest ? "?" + rest : "") + window.location.hash);
  }
  return id;
}

function redirectToGoogle(extra: Record<string, string> = {}) {
  const state = Array.from(crypto.getRandomValues(new Uint32Array(4))).join("-");
  session()?.setItem(STATE_KEY, state);
  session()?.setItem(RETURN_KEY, window.location.pathname + window.location.search);
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: "token",
    scope: GOOGLE_SCOPES.join(" "),
    include_granted_scopes: "true",
    state,
    ...extra,
  });
  window.location.assign("https://accounts.google.com/o/oauth2/v2/auth?" + params);
}

/** What to carry on with after the round trip to Google (e.g. connecting or creating a Sheet). */
export function rememberPending(action: string): void {
  session()?.setItem(PENDING_KEY, action);
}

/**
 * Call once at startup, before the router reads the URL: if we're coming back from Google,
 * keep the token, restore the page the coach was on, and scrub the token out of the address
 * bar. Also hands back what the coach was doing when sign-in started (see rememberPending).
 */
export function completeRedirect(): { error?: string; pending?: string } {
  if (typeof window === "undefined") return {};
  const pending = session()?.getItem(PENDING_KEY) ?? undefined;
  session()?.removeItem(PENDING_KEY);

  const silent = !!session()?.getItem(SILENT_PENDING_KEY);
  session()?.removeItem(SILENT_PENDING_KEY);
  const hash = window.location.hash.slice(1);
  if (!/(^|&)(access_token|error)=/.test(hash)) return { pending };
  const p = new URLSearchParams(hash);
  const expected = session()?.getItem(STATE_KEY);
  const returnTo = session()?.getItem(RETURN_KEY) || window.location.pathname;
  session()?.removeItem(STATE_KEY);
  session()?.removeItem(RETURN_KEY);
  history.replaceState(null, "", returnTo);

  // A quiet renewal that needs the coach to click something just ends quietly: the app shows
  // its usual "Sign in" button instead of an error.
  if (silent && p.get("error")) return { pending };
  if (p.get("error")) {
    return { pending, error: p.get("error") === "access_denied" ? "Sign-in was cancelled." : "Google sign-in failed: " + p.get("error") };
  }
  if (!expected || p.get("state") !== expected) {
    return { pending, error: "Sign-in response didn't match this app — please try again." };
  }
  const token: StoredToken = {
    accessToken: p.get("access_token")!,
    // Treat it as expired a minute early so a request never goes out with a dying token.
    expiresAt: Date.now() + (Number(p.get("expires_in")) || 3600) * 1000 - 60_000,
  };
  session()?.setItem(TOKEN_KEY, JSON.stringify(token));
  return { pending };
}

export async function accessToken(): Promise<string | null> {
  try {
    const t = JSON.parse(session()?.getItem(TOKEN_KEY) ?? "null") as StoredToken | null;
    return t && t.expiresAt > Date.now() ? t.accessToken : null;
  } catch {
    return null;
  }
}

export async function forgetToken(token: string | null): Promise<void> {
  session()?.removeItem(TOKEN_KEY);
  // Best effort: also revoke it on Google's side.
  if (token) fetch("https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(token), { method: "POST" }).catch(() => {});
}

export function signedInEmail(): string | null {
  return null; // the implicit flow doesn't say who signed in, and the app doesn't need to know
}

export async function signOut(): Promise<void> {
  await forgetToken(await accessToken());
}
