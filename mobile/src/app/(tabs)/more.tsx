// More — coaches, the connected Sheet, and sign-out.

import { router } from "expo-router";
import { useState } from "react";
import { Linking, Platform, View } from "react-native";
import type { Coach } from "@/core/schema/model";
import { coachDays, otherDaysNote } from "@/core/logic/coachDays";
import { shortDay } from "@/core/logic/dates";
import { formatClock } from "@/core/logic/timeline";
import { approveAccountAccess, connectSheet, disconnect, refresh, useAppState } from "@/data/store";
import { signedInEmail } from "@/platform/auth";
import { COMPANY, PRIVACY_URL } from "@/core/config";
import { LOCK_SUPPORTED } from "@/platform/lock";
import { confirmAction } from "@/ui/form";
import { Banner, Button, Card, LinkButton, ListRow, Row, Screen, Section, T } from "@/ui/kit";

function days(c: Coach): string {
  return coachDays(c).map(shortDay).join(" · ");
}

export default function More() {
  const s = useAppState();
  const [open, setOpen] = useState<number | null>(null);
  if (!s.data) return null;
  const coaches = [...s.data.coaches].sort((a, b) => (a.status === b.status ? a.row - b.row : a.status === "Active" ? -1 : 1));
  const email = s.source?.kind === "sheet" ? signedInEmail() : null;

  const { tierNames, practiceDays, practice } = s.data.settings;

  return (
    <Screen>
      <Section title="Team">
        <ListRow title="Team settings"
          subtitle={`${tierNames.length} group${tierNames.length === 1 ? "" : "s"} · ${practiceDays.map(shortDay).join(", ")} · ${formatClock(practice.start)}–${formatClock(practice.end, true)}`}
          onPress={() => router.push("/team")} />
        {s.source?.kind === "sheet" && (
          <ListRow title="Create another team's Sheet" subtitle="A separate Sheet for a team with its own groups, days and times"
            onPress={() => router.push("/new-team")} />
        )}
      </Section>

      <Section title="Coaches">
        {coaches.map((c) => (
          <View key={c.row}>
            <ListRow title={c.fullName} dim={c.status === "Inactive"} subtitle={[c.role, c.status === "Inactive" ? "Inactive" : "", days(c)].filter(Boolean).join(" · ")}
              onPress={() => setOpen(open === c.row ? null : c.row)} />
            {open === c.row && (
              <Card style={{ marginTop: -2 }}>
                <View style={{ gap: 6 }}>
                  {c.email ? <LinkButton label={c.email} onPress={() => Linking.openURL(`mailto:${c.email}`)} /> : null}
                  {c.phone ? <LinkButton label={c.phone} onPress={() => Linking.openURL(`tel:${c.phone.replace(/[^\d+]/g, "")}`)} /> : null}
                  {otherDaysNote(c.otherDays) ? <T><T muted>Other days: </T>{c.otherDays}</T> : null}
                  {c.specialties ? <T><T muted>Specialties: </T>{c.specialties}</T> : null}
                  {c.bio ? <T>{c.bio}</T> : null}
                  <Button label="Edit coach" icon="edit" onPress={() => router.push({ pathname: "/edit/coach", params: { row: String(c.row) } })} />
                </View>
              </Card>
            )}
          </View>
        ))}
        <Button label="Add a coach" icon="plus" style={{ marginTop: 6 }} onPress={() => router.push("/edit/coach")} />
      </Section>

      <Section title="Data">
        <Card>
          <View style={{ gap: 8 }}>
            {s.source?.kind === "demo" ? (
              <T>You're looking at <T bold>demo data</T> built from the example workbook. Changes you save stay on this {Platform.OS === "web" ? "device" : "phone"}.</T>
            ) : s.source?.kind === "sheet" ? (
              <>
                <T>Connected to <T bold>{s.source.title}</T>{email ? ` as ${email}` : ""}.</T>
                <LinkButton label="Open the Sheet in Google Sheets" onPress={() => Linking.openURL(`https://docs.google.com/spreadsheets/d/${s.source?.kind === "sheet" ? s.source.spreadsheetId : ""}/edit`)} />
              </>
            ) : null}
            {s.fetchedAt ? <T small muted>Last updated {new Date(s.fetchedAt).toLocaleString()}</T> : null}
            {s.source?.kind === "sheet" && <Button label="Share this Sheet" icon="athletes" kind="primary" onPress={() => router.push("/share")} />}
            <Row>
              {s.source?.kind === "sheet" && <Button label="Refresh now" disabled={s.loading} busy={s.loading} onPress={refresh} style={{ flexGrow: 1 }} />}
              <Button label={s.source?.kind === "demo" ? "Leave demo" : "Sign out & clear data"} kind="danger" style={{ flexGrow: 1 }}
                onPress={() => confirmAction(
                  s.source?.kind === "demo" ? "Leave the demo?" : "Sign out?",
                  s.source?.kind === "demo" ? "Demo changes will be discarded." : "This removes all team data saved on this device. The Sheet itself isn't changed, and it stays in your list of Sheets for one-tap reconnecting.",
                  s.source?.kind === "demo" ? "Leave demo" : "Sign out",
                  () => { disconnect(); })} />
            </Row>
          </View>
        </Card>
        {s.accountNeedsApproval && s.source?.kind === "sheet" && (
          <Card>
            <T bold>Save this Sheet to your Google account</T>
            <T small muted style={{ marginVertical: 6 }}>Then signing in on any phone or computer opens it — no link needed. Google asks for your OK once.</T>
            <Button label="Allow" kind="primary" onPress={approveAccountAccess} />
          </Card>
        )}
        {s.knownSheets.filter((k) => s.source?.kind !== "sheet" || k.id !== s.source.spreadsheetId).length > 0 && (
          <Card>
            <T bold>Switch to another Sheet</T>
            {s.knownSheets.filter((k) => s.source?.kind !== "sheet" || k.id !== s.source.spreadsheetId).map((k) => (
              <Row key={k.id} style={{ justifyContent: "space-between", flexWrap: "nowrap", borderTopWidth: 1, borderTopColor: "transparent", paddingTop: 8 }}>
                <T style={{ flex: 1 }} numberOfLines={1}>{k.title}</T>
                <Button label="Switch" disabled={s.loading} busy={s.loading && s.connectingTo === k.id} style={{ minHeight: 40 }}
                  onPress={() => confirmAction(`Switch to ${k.title}?`, "The app will show that Sheet instead. You can switch back here any time.", "Switch", () => { connectSheet(k.id); })} />
              </Row>
            ))}
          </Card>
        )}
        {LOCK_SUPPORTED && s.source?.kind === "sheet" && !s.lockAvailable && (
          <View style={{ marginHorizontal: -16, marginTop: 4 }}>
            <Banner>This phone has no screen lock, so Climbing Coach Manager can't lock itself. Set a PIN or fingerprint in the phone's settings to protect the team data.</Banner>
          </View>
        )}
      </Section>

      <Section title="About">
        <T small muted>
          Climbing Coach Manager{Platform.OS === "web" ? " (web)" : ""} — everything shown comes from the team's Google Sheet, and every change is saved straight to it.
          This app keeps a copy on this {Platform.OS === "web" ? "device" : "phone (encrypted)"} so it opens instantly and works without signal; saving needs a connection.
        </T>
        <T small muted style={{ marginTop: 8 }}>Athletes are minors: keep notes climbing-specific — no medical or family details, no photos.</T>
        <View style={{ marginTop: 10, gap: 8 }}>
          <LinkButton label="Privacy policy" onPress={() => Linking.openURL(PRIVACY_URL)} />
          <LinkButton label={`Made by ${COMPANY.name}`} onPress={() => Linking.openURL(COMPANY.url)} />
        </View>
      </Section>
    </Screen>
  );
}
