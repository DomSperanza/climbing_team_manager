// Root: starts the data store, keeps the splash screen up until saved data is loaded, shows
// the Connect screen until a Sheet (or the demo) is connected, and covers everything with
// the lock screen when the app is locked.

import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform, useColorScheme } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { init, useAppState } from "@/data/store";
import { LockScreen } from "@/ui/LockScreen";
import { useTheme } from "@/ui/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});
// Must run before the router reads the URL: a return from Google sign-in (web) puts the token there.
const started = init();

if (Platform.OS === "web" && typeof navigator !== "undefined" && "serviceWorker" in navigator && process.env.NODE_ENV === "production") {
  navigator.serviceWorker.register((process.env.EXPO_BASE_URL ?? "").replace(/\/?$/, "/") + "sw.js").catch(() => { /* app still works, just not offline */ });
}

export default function RootLayout() {
  const s = useAppState();
  const t = useTheme();
  const scheme = useColorScheme();
  const hasData = !!s.source && !!s.data;

  useEffect(() => {
    if (s.ready) SplashScreen.hideAsync().catch(() => {});
  }, [s.ready]);
  useEffect(() => { started.catch(() => {}); }, []);

  if (!s.ready) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{
        headerStyle: { backgroundColor: t.bg },
        headerTintColor: t.accent,
        headerTitleStyle: { color: t.text },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: t.bg },
      }}>
        <Stack.Protected guard={hasData}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false, title: "Rock Team" }} />
          <Stack.Screen name="athlete/[row]" options={{ title: "Athlete" }} />
          <Stack.Screen name="exercise/[row]" options={{ title: "Exercise" }} />
          <Stack.Screen name="edit/block" options={{ presentation: "modal", title: "Workout block" }} />
          <Stack.Screen name="edit/progress" options={{ presentation: "modal", title: "Progress entry" }} />
          <Stack.Screen name="edit/athlete" options={{ presentation: "modal", title: "Athlete" }} />
          <Stack.Screen name="edit/coach" options={{ presentation: "modal", title: "Coach" }} />
          <Stack.Screen name="edit/exercise" options={{ presentation: "modal", title: "Exercise" }} />
          <Stack.Screen name="share" options={{ presentation: "modal", title: "Share this Sheet" }} />
          <Stack.Screen name="attendance" options={{ title: "Who was there" }} />
          <Stack.Screen name="workouts/[row]" options={{ title: "Workouts" }} />
          <Stack.Screen name="edit/attendance" options={{ presentation: "modal", title: "Practice" }} />
        </Stack.Protected>
        <Stack.Protected guard={!hasData}>
          <Stack.Screen name="connect" options={{ headerShown: false, title: "Rock Team" }} />
          <Stack.Screen name="setup" options={{ title: "New team Sheet" }} />
        </Stack.Protected>
      </Stack>
      {s.locked && <LockScreen />}
    </SafeAreaProvider>
  );
}
