// Google sign-in on Android and iOS: the phone's own Google account picker (Credential
// Manager on Android, the Google Sign-In SDK on iOS). No server and no client secret — the
// app gets a short-lived access token for the Sheets API and the OS keeps the sign-in, so
// coaches aren't asked again every hour the way the web version asks.
// The web version is auth.web.ts.

import {
  GoogleOneTapSignIn,
  isCancelledResponse,
  isErrorWithCode,
  isNoSavedCredentialFoundResponse,
  isSuccessResponse,
  statusCodes,
  type OneTapResponse,
} from "react-native-nitro-google-signin";
import { GOOGLE_SCOPES } from "@/core/config";

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";

export type SignInResult = { status: "ok" } | { status: "cancelled" } | { status: "error"; message: string } | { status: "redirecting" };

let configured = false;
function configure() {
  if (configured) return;
  GoogleOneTapSignIn.configure({ webClientId: WEB_CLIENT_ID, iosClientId: IOS_CLIENT_ID || null, scopes: GOOGLE_SCOPES });
  configured = true;
}

export function isAuthConfigured(): boolean {
  return WEB_CLIENT_ID.length > 0;
}

function describe(e: unknown): string {
  if (isErrorWithCode(e)) {
    if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) return "Google Play services is missing or out of date on this phone.";
    if (e.code === statusCodes.DEVELOPER_ERROR) {
      return "Google rejected this copy of the app. The Android OAuth client in Google Cloud needs this app's package name and signing SHA-1 (see mobile/README.md).";
    }
    return `Google sign-in failed (${e.code}): ${e.message}`;
  }
  return "Google sign-in failed: " + String(e);
}

/** Shows the account picker. Resolves once the coach has signed in (or backed out). */
export async function signIn(): Promise<SignInResult> {
  if (!isAuthConfigured()) return { status: "error", message: "Google sign-in isn't set up in this build of the app (see mobile/README.md)." };
  configure();
  try {
    await GoogleOneTapSignIn.checkPlayServices();
    // Returning user → new account on this phone → the full "Sign in with Google" sheet.
    let res: OneTapResponse = await GoogleOneTapSignIn.signIn();
    if (isNoSavedCredentialFoundResponse(res)) res = await GoogleOneTapSignIn.createAccount();
    if (isNoSavedCredentialFoundResponse(res)) res = await GoogleOneTapSignIn.presentExplicitSignIn();
    if (isCancelledResponse(res)) return { status: "cancelled" };
    if (!isSuccessResponse(res)) return { status: "error", message: "Google sign-in didn't finish. Please try again." };
    // Ask for Sheets access now (shows Google's consent screen the first time), so a
    // missing grant surfaces here rather than as a failed refresh later.
    await GoogleOneTapSignIn.getTokens();
    return { status: "ok" };
  } catch (e) {
    if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_CANCELLED) return { status: "cancelled" };
    return { status: "error", message: describe(e) };
  }
}

/** Asks Google for any permission this sign-in hasn't granted yet (e.g. one added in an app update). */
export async function grantMoreAccess(): Promise<SignInResult> {
  if (!isAuthConfigured()) return { status: "error", message: "Google sign-in isn't set up in this build of the app." };
  configure();
  try {
    await GoogleOneTapSignIn.requestScopes(GOOGLE_SCOPES);
    return { status: "ok" };
  } catch (e) {
    if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_CANCELLED) return { status: "cancelled" };
    return { status: "error", message: describe(e) };
  }
}

/** A current access token, or null when the coach needs to sign in (again). Never shows UI. */
export async function accessToken(): Promise<string | null> {
  if (!isAuthConfigured()) return null;
  configure();
  if (!GoogleOneTapSignIn.getCurrentUser()) return null;
  try {
    return (await GoogleOneTapSignIn.getTokens()).accessToken ?? null;
  } catch {
    return null;
  }
}

/** After a 401: drop the stale token so the next accessToken() fetches a fresh one. */
export async function forgetToken(token: string | null): Promise<void> {
  if (token) await GoogleOneTapSignIn.clearCachedAccessToken(token).catch(() => {});
}

export function signedInEmail(): string | null {
  if (!isAuthConfigured()) return null;
  configure();
  return GoogleOneTapSignIn.getCurrentUser()?.user.email ?? null;
}

export async function signOut(): Promise<void> {
  if (!isAuthConfigured()) return;
  configure();
  await GoogleOneTapSignIn.signOut().catch(() => {});
}

// Web-only: the phone apps renew the sign-in silently on their own (see accessToken), and
// invite links open the web version.
export function trySilentSignIn(): boolean {
  return false;
}
export function takeLinkedSheet(): string | null {
  return null;
}

// Web-only redirect bookkeeping; native sign-in never leaves the app.
export function rememberPending(_action: string): void {}
export function completeRedirect(): { error?: string; pending?: string } {
  return {};
}
