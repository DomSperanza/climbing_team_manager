// Covers the app until the phone's fingerprint / face / PIN check passes.

import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { unlockApp } from "@/data/store";
import { Icon } from "./Icon";
import { Button, H2, T } from "./kit";
import { useTheme } from "./theme";

export function LockScreen() {
  const t = useTheme();
  useEffect(() => { unlockApp(); }, []); // ask right away; the button is for a second try
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: t.bg, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 }]}>
      <Icon name="lock" size={56} color={t.accent} />
      <H2>Rock Team is locked</H2>
      <T muted style={{ textAlign: "center" }}>Team data is protected with your phone's screen lock.</T>
      <Button label="Unlock" kind="primary" onPress={unlockApp} style={{ alignSelf: "stretch" }} />
    </View>
  );
}
