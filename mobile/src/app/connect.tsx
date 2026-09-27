// First-run screen: create a new team Sheet, connect an existing one, or try the demo.

import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spreadsheetIdFrom } from "@/core/config";
import { connectSheet, startDemo, useAppState } from "@/data/store";
import { isAuthConfigured } from "@/platform/auth";
import { Button, Card, H2, T } from "@/ui/kit";
import { useTheme } from "@/ui/theme";

export default function Connect() {
  const t = useTheme();
  const s = useAppState();
  const insets = useSafeAreaInsets();
  // Keep the link filled in after a round trip to Google sign-in, so a failed connect can be retried.
  const [link, setLink] = useState(s.connectingTo ? `https://docs.google.com/spreadsheets/d/${s.connectingTo}/edit` : "");
  const [localError, setLocalError] = useState("");
  const configured = isAuthConfigured();
  const connectError = s.connectingTo || localError ? localError || s.error : null;

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
          <H2>Rock Team</H2>
          <T muted style={{ textAlign: "center" }}>Practice plans, roster and exercise library — kept in a Google Sheet your coaches share.</T>
        </View>

        {!configured && (
          <T small style={{ color: t.warnText, marginBottom: 12, textAlign: "center" }}>Google sign-in isn't set up in this build yet (see mobile/README.md). The demo works without it.</T>
        )}

        <Card style={{ padding: 16 }}>
          <T bold>Starting fresh?</T>
          <T small muted style={{ marginTop: 4, marginBottom: 12 }}>
            Create the team Sheet in your Google Drive, with every tab, formula and dropdown ready to go. It's private until you share it with your coaches.
          </T>
          <Button label="Create a new team Sheet" kind="primary" icon="plus" disabled={!configured || s.loading} onPress={() => router.push("/setup")} />
        </Card>

        <Card style={{ padding: 16 }}>
          <T bold>Connect an existing Sheet</T>
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
