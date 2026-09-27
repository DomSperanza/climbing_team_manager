// The five sections, with a shared header: section title, which Sheet is connected, a
// refresh button, and a banner when offline / signed out / something went wrong.

import { Tabs } from "expo-router";
import { ActivityIndicator, Platform, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { refresh, signInAgain, useAppState } from "@/data/store";
import { Icon, type IconName } from "@/ui/Icon";
import { Banner, IconButton, LinkButton, MAX_WIDTH } from "@/ui/kit";
import { useTheme } from "@/ui/theme";

const TABS: { name: string; label: string; title: string; icon: IconName }[] = [
  { name: "index", label: "Today", title: "Today's plan", icon: "today" },
  { name: "athletes", label: "Athletes", title: "Athletes", icon: "athletes" },
  { name: "library", label: "Library", title: "Exercise library", icon: "library" },
  { name: "more", label: "More", title: "Coaches & settings", icon: "more" },
];

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs screenOptions={{
      header: ({ options }) => <Header title={options.title ?? ""} />,
      tabBarActiveTintColor: t.accent,
      tabBarInactiveTintColor: t.muted,
      // The web tab bar gets no safe-area padding, which leaves its labels too little room.
      tabBarStyle: [{ backgroundColor: t.surface, borderTopColor: t.line }, Platform.OS === "web" && { height: 64 }],
      tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
      sceneStyle: { backgroundColor: t.bg },
    }}>
      {TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} options={{
          title: tab.title,
          tabBarLabel: tab.label,
          tabBarIcon: ({ color }) => <Icon name={tab.icon} color={color} />,
        }} />
      ))}
    </Tabs>
  );
}

function Header({ title }: { title: string }) {
  const t = useTheme();
  const s = useAppState();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: t.bg, paddingTop: insets.top }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8, gap: 8, width: "100%", maxWidth: MAX_WIDTH, alignSelf: "center" }}>
        <View style={{ flex: 1 }}>
          <Text accessibilityRole="header" style={{ color: t.text, fontSize: 22, fontWeight: "700" }} numberOfLines={1}>{title}</Text>
          <Text style={{ color: t.muted, fontSize: 13 }} numberOfLines={1}>{s.source?.kind === "demo" ? "Demo data" : s.source?.title}</Text>
        </View>
        {s.source?.kind === "sheet" && (s.loading
          ? <View style={{ width: 44, alignItems: "center" }}><ActivityIndicator color={t.accent} /></View>
          : <IconButton icon="refresh" label="Refresh from the Sheet" onPress={() => (s.needsSignIn ? signInAgain() : refresh())} />)}
      </View>
      <StatusBanner />
    </View>
  );
}

function StatusBanner() {
  const s = useAppState();
  const when = s.fetchedAt ? new Date(s.fetchedAt).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" }) : "";
  if (s.source?.kind !== "sheet") return null;
  if (!s.online) return <Banner>Offline — showing data saved {when}. Saving is off until you reconnect.</Banner>;
  if (s.needsSignIn) {
    return (
      <Banner action={<LinkButton label="Sign in to refresh and save" onPress={signInAgain} />}>
        {s.error && s.error !== "Your Google sign-in has expired." ? s.error + " " : ""}Showing data saved {when}.
      </Banner>
    );
  }
  if (s.error) return <Banner kind="error">{s.error}</Banner>;
  return null;
}
