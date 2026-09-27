// Share the team Sheet: who has access, invite a coach by email, remove someone. This is the
// Sheet's own Google sharing list — the app keeps no separate list of who's allowed in.

import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, ScrollView, View } from "react-native";
import { peopleWithAccess, shareWith, stopSharingWith, useAppState } from "@/data/store";
import type { Person, Role } from "@/google/drive";
import { confirmAction, SelectField, TextField } from "@/ui/form";
import { Banner, Button, Card, LinkButton, MAX_WIDTH, MutedChip, Row, Section, T } from "@/ui/kit";
import { useTheme } from "@/ui/theme";

const ROLE_LABEL: Record<string, string> = { owner: "Owner", writer: "Can edit", commenter: "Can comment", reader: "Can view" };

export default function Share() {
  const t = useTheme();
  const s = useAppState();
  const [people, setPeople] = useState<Person[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("writer");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const sheetUrl = s.source?.kind === "sheet" ? `https://docs.google.com/spreadsheets/d/${s.source.spreadsheetId}/edit` : null;
  const blocked = s.source?.kind !== "sheet" ? "Sharing needs a real Sheet — it isn't available in the demo." : !s.online ? "You're offline — sharing needs a connection." : null;

  const [reloads, setReloads] = useState(0);
  const reload = () => setReloads((n) => n + 1);
  useEffect(() => {
    if (blocked) return;
    let live = true;
    peopleWithAccess().then(
      (list) => { if (live) { setPeople(list); setListError(null); } },
      (e) => { if (live) setListError(e instanceof Error ? e.message : String(e)); });
    return () => { live = false; };
  }, [blocked, reloads]);

  const invite = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await shareWith(email, role);
      setMessage({ kind: "ok", text: `Shared with ${email.trim()}. Google has emailed them the link.` });
      setEmail("");
      reload();
    } catch (e) {
      setMessage({ kind: "error", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  const remove = (p: Person) => confirmAction(`Remove ${p.email || p.name}?`,
    "They won't be able to open the Sheet or use it in the app anymore. The copy on their phone stops updating; it's wiped when they sign out.",
    "Remove", async () => {
      try { await stopSharingWith(p.id); reload(); } catch (e) { setMessage({ kind: "error", text: e instanceof Error ? e.message : String(e) }); }
    });

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Stack.Screen options={{ title: "Share this Sheet" }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, width: "100%", maxWidth: MAX_WIDTH, alignSelf: "center" }} keyboardShouldPersistTaps="handled">
        {blocked ? <View style={{ marginHorizontal: -16 }}><Banner>{blocked}</Banner></View> : (
          <>
            <T muted>Everyone you add can see the athletes' details, so only share with coaches. Google emails them a link; they open the Rock Team app, choose "Connect an existing Sheet", and paste it.</T>

            {people !== null && !listError && <Section title="Invite a coach">
              <TextField label="Their Google account email" value={email} onChange={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="coach@gmail.com" />
              <SelectField label="Access" value={role} onChange={(v) => setRole(v as Role)} options={[
                { value: "writer", label: "Can edit", sub: "Plan workouts, log progress, update the roster" },
                { value: "reader", label: "Can view", sub: "See everything, change nothing" },
              ]} />
              {message && <View style={{ marginHorizontal: -16, marginBottom: 12 }}><Banner kind={message.kind === "error" ? "error" : "warn"}>{message.text}</Banner></View>}
              <Button label="Share" kind="primary" busy={busy} disabled={!email.trim()} onPress={invite} />
            </Section>}

            <Section title="Who has access">
              {listError ? (
                <Card>
                  <T>{listError}</T>
                  {sheetUrl && <View style={{ marginTop: 10 }}><LinkButton label="Open the Sheet in Google Sheets" onPress={() => Linking.openURL(sheetUrl)} /></View>}
                </Card>
              ) : people === null ? (
                <ActivityIndicator color={t.accent} style={{ marginVertical: 16 }} />
              ) : people.map((p) => (
                <Card key={p.id}>
                  <Row style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <T bold numberOfLines={1}>{p.name || p.email || (p.type === "anyone" ? "Anyone with the link" : p.type)}</T>
                      {p.name && p.email ? <T small muted numberOfLines={1}>{p.email}</T> : null}
                    </View>
                    <MutedChip label={ROLE_LABEL[p.role] ?? p.role} />
                  </Row>
                  {p.type === "anyone" && <T small style={{ color: t.danger, marginTop: 6 }}>Anyone with the link can open this Sheet. The team data is about minors — consider removing this.</T>}
                  {p.role !== "owner" && <View style={{ marginTop: 8, alignItems: "flex-start" }}><LinkButton label="Remove access" onPress={() => remove(p)} /></View>}
                </Card>
              ))}
            </Section>

            <T small muted style={{ marginTop: 16 }}>
              Setting up: while the app's Google sign-in is in "Testing" mode, each coach also has to be listed as a test user in Google Cloud (see mobile/README.md), or Google won't let them sign in.
            </T>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
