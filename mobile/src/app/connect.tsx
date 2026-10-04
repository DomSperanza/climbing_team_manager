// Connect screen: "Sign in with Google" (finds the team Sheets saved to the coach's Google
// account, from any device), a Sheet from an invite link, the Sheets this device already
// knows (one tap), or create a new team Sheet / paste a link / try the demo.

import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spreadsheetIdFrom } from "@/core/config";
import { approveAccountAccess, connectSheet, forgetKnownSheet, signInWithGoogle, startDemo, useAppState } from "@/data/store";
import { isAuthConfigured } from "@/platform/auth";
import { Button, Card, H2, LinkButton, Row, T } from "@/ui/kit";
import { useTheme } from "@/ui/theme";

export default function Connect() {
  const t = useTheme();
  const s = useAppState();
  const insets = useSafeAreaInsets();
  // Keep the link filled in after a round trip to Google sign-in, so a failed connect can be retried.
  const [link, setLink] = useState(s.connectingTo && !s.invited ? `https://docs.google.com/spreadsheets/d/${s.connectingTo}/edit` : "");
  const [localError, setLocalError] = useState("");
  const configured = isAuthConfigured();
  // Errors for the paste-a-link card only (the other cards show their own).
  const fromList = !!s.connectingTo && (s.connectingTo === s.invited || s.knownSheets.some((k) => k.id === s.connectingTo) || !!s.found?.some((f) => f.id === s.connectingTo));
  // (Sign-in results include this device's Sheets, so that list is only shown before signing in.)
  const connectError = localError || (s.connectingTo && !fromList ? s.error : null);

  const submit = () => {
    const id = spreadsheetIdFrom(link);
    if (!id) { setLocalError("That doesn't look like a Google Sheets link. Open the Sheet (or the invite email), copy its link, and paste it here."); return; }
    setLocalError("");
    connectSheet(id);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24, width: "100%", maxWidth: 480, alignSelf: "center" }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: "center", gap: 10, marginBottom: 24 }}>
          <Image source={require("@/assets/images/icon.png")} style={{ width: 84, height: 84, borderRadius: 20 }} accessibilityIgnoresInvertColors />
          <H2>Climbing Coach Manager</H2>
          <T muted style={{ textAlign: "center" }}>Practice plans, roster and exercise library — kept in a Google Sheet your coaches share.</T>
        </View>

        {!configured && (
          <T small style={{ color: t.warnText, marginBottom: 12, textAlign: "center" }}>Google sign-in isn't set up in this build yet (see mobile/README.md). The demo works without it.</T>
        )}

        {s.invited && (
          <Card style={{ padding: 16, borderColor: t.accent, borderWidth: 2 }}>
            <T bold>You've been invited to a team Sheet</T>
            <T small muted style={{ marginTop: 4, marginBottom: 12 }}>Sign in with the Google account the invite was sent to.</T>
            <Button label={s.loading ? "Connecting…" : "Sign in with Google & connect"} kind="primary" busy={s.loading}
              disabled={!configured || s.loading} onPress={() => connectSheet(s.invited!)} />
            {s.error && s.connectingTo === s.invited ? <T small style={{ color: t.danger, marginTop: 10 }}>{s.error}</T> : null}
          </Card>
        )}

        {!s.invited && (
          <Card style={{ padding: 16, borderColor: t.accent, borderWidth: s.found === null && !s.knownSheets.length ? 2 : 1 }}>
            <T bold>Sign in with Google</T>
            <T small muted style={{ marginTop: 4, marginBottom: 12 }}>
              Opens your team Sheet. The Sheets you use are saved to your Google account, so this works on any phone or computer.
            </T>
            {s.found === null ? (
              <>
                <Button label={s.loading && !s.connectingTo ? "Signing in…" : "Sign in with Google"} kind="primary" busy={s.loading && !s.connectingTo}
                  disabled={!configured || s.loading} onPress={signInWithGoogle} />
                {s.error && !s.connectingTo && !s.setupDraft ? <T small style={{ color: t.danger, marginTop: 10 }}>{s.error}</T> : null}
              </>
            ) : s.found.length === 0 ? (
              <T small muted>
                No team Sheets saved to this Google account yet. Were you invited? Tap the link in the invite email, or paste the Sheet's link below.
                Setting up a new team? Use "Create a new team Sheet".
              </T>
            ) : (
              <>
                {s.found.length > 1 && <T small muted style={{ marginBottom: 4 }}>Which team Sheet?</T>}
                {s.found.map((f) => (
                  <Row key={f.id} style={{ justifyContent: "space-between", flexWrap: "nowrap", borderTopWidth: 1, borderTopColor: t.line, paddingVertical: 8 }}>
                    <T bold style={{ flex: 1 }} numberOfLines={1}>{f.title}</T>
                    <Button label="Connect" kind="primary" disabled={s.loading} busy={s.loading && s.connectingTo === f.id} onPress={() => connectSheet(f.id)} style={{ minHeight: 40 }} />
                  </Row>
                ))}
                {s.error && s.connectingTo && s.found.some((f) => f.id === s.connectingTo) ? <T small style={{ color: t.danger, marginTop: 6 }}>{s.error}</T> : null}
              </>
            )}
            {s.accountNeedsApproval && (
              <View style={{ marginTop: 12, gap: 8 }}>
                <T small>To save your Sheets to your Google account (so you're not asked for the link again), Google needs your OK once.</T>
                <Button label="Allow" onPress={approveAccountAccess} />
              </View>
            )}
          </Card>
        )}

        {s.knownSheets.length > 0 && s.found === null && (
          <Card style={{ padding: 16 }}>
            <T bold>Your team Sheets</T>
            <T small muted style={{ marginTop: 4, marginBottom: 8 }}>Sheets you've used on this {Platform.OS === "web" ? "device" : "phone"}. One tap to reconnect.</T>
            {s.knownSheets.map((k) => (
              <View key={k.id} style={{ borderTopWidth: 1, borderTopColor: t.line, paddingVertical: 10, gap: 6 }}>
                <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
                  <T bold style={{ flex: 1 }} numberOfLines={1}>{k.title}</T>
                  <LinkButton label="Forget" onPress={() => forgetKnownSheet(k.id)} />
                </Row>
                <Button label={s.loading && s.connectingTo === k.id ? "Connecting…" : "Connect"} kind="primary" busy={s.loading && s.connectingTo === k.id}
                  disabled={!configured || s.loading} onPress={() => connectSheet(k.id)} />
              </View>
            ))}
            {s.error && s.connectingTo && s.knownSheets.some((k) => k.id === s.connectingTo) ? <T small style={{ color: t.danger, marginTop: 6 }}>{s.error}</T> : null}
          </Card>
        )}

        <Card style={{ padding: 16 }}>
          <T bold>Starting fresh?</T>
          <T small muted style={{ marginTop: 4, marginBottom: 12 }}>
            Create the team Sheet in your Google Drive, with every tab, formula and dropdown ready to go. It's private until you share it with your coaches.
          </T>
          <Button label="Create a new team Sheet" kind="primary" icon="plus" disabled={!configured || s.loading} onPress={() => router.push("/setup")} />
        </Card>

        <Card style={{ padding: 16 }}>
          <T bold>{s.knownSheets.length ? "Connect another Sheet by link" : "Connect an existing Sheet"}</T>
          <T small muted style={{ marginTop: 4, marginBottom: 12 }}>
            Were you invited? Paste the Sheet's link from the invite email (or from Google Sheets). You'll sign in with the Google account it was shared with.
          </T>
          <TextInput value={link} onChangeText={setLink} editable={configured} placeholder="https://docs.google.com/spreadsheets/d/…" placeholderTextColor={t.muted}
            accessibilityLabel="Sheet link" autoCapitalize="none" autoCorrect={false} keyboardType="url" returnKeyType="go" onSubmitEditing={submit}
            style={{ color: t.text, fontSize: 16, borderWidth: 1, borderColor: t.line, borderRadius: 12, paddingHorizontal: 12, minHeight: 48, marginBottom: 12, backgroundColor: t.bg }} />
          <Button label={s.loading && s.connectingTo ? "Connecting…" : "Sign in with Google & connect"} busy={s.loading && !!s.connectingTo}
            disabled={!configured || s.loading || !link.trim()} onPress={submit} />
          {connectError ? <T small style={{ color: t.danger, marginTop: 10 }}>{connectError}</T> : null}
        </Card>

        <T muted style={{ textAlign: "center", marginVertical: 12 }}>or</T>
        <Button label="Try it with demo data" onPress={startDemo} disabled={s.loading} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
