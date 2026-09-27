// Picking an exercise for a workout block, with the same search and filters as the Library
// tab. Opens already filtered to the block's tier, so an Advanced block shows Advanced and
// All Levels exercises first.

import { useState } from "react";
import { FlatList, Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { filterLibrary, timesUsed } from "@/core/logic/library";
import type { TeamData } from "@/core/schema/model";
import { FieldLabel } from "./form";
import { Icon } from "./Icon";
import { FilterChips, LinkButton, MAX_WIDTH, SearchBox, T, TierChip } from "./kit";
import { RADIUS, useTheme } from "./theme";

export function ExercisePicker({ data, value, onChange, tier }: {
  data: TeamData; value: string; onChange: (name: string) => void; tier: string; // the block's group
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { library, settings, log } = data;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [blockType, setBlockType] = useState("");
  const [tierFilter, setTierFilter] = useState("");

  const show = () => {
    setQuery("");
    setBlockType("");
    setTierFilter(settings.tierNames.includes(tier) ? tier : "");
    setOpen(true);
  };
  const pick = (name: string) => { onChange(name); setOpen(false); };

  const visible = filterLibrary(library, { query, blockType, tier: tierFilter });
  const typesInUse = settings.blockTypes.filter((bt) => library.some((e) => e.blockType === bt));
  const filtered = !!(query || blockType || tierFilter);

  return (
    <View style={{ marginBottom: 14 }}>
      <FieldLabel label="Pick from library" hint="Optional. Fills in the fields below, which you can still change." />
      <Pressable accessibilityRole="button" accessibilityLabel={`Pick from library: ${value || "none"}`} onPress={show}
        style={{ flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface, borderRadius: 12, paddingHorizontal: 12, minHeight: 48 }}>
        <Icon name="library" size={20} color={t.muted} />
        <Text style={{ flex: 1, color: value ? t.text : t.muted, fontSize: 16 }} numberOfLines={1}>{value || "Choose an exercise…"}</Text>
        <Icon name="chevronDown" size={20} color={t.muted} />
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={{ height: insets.top + 24, backgroundColor: "#0006" }} onPress={() => setOpen(false)} accessibilityLabel="Close" />
        <View style={{ flex: 1, backgroundColor: t.bg, borderTopLeftRadius: RADIUS, borderTopRightRadius: RADIUS, paddingTop: 12, paddingHorizontal: 16, paddingBottom: insets.bottom + 8, width: "100%", maxWidth: MAX_WIDTH, alignSelf: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <T bold style={{ fontSize: 18 }}>Pick an exercise</T>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} onPress={() => setOpen(false)}><Icon name="close" color={t.muted} /></Pressable>
          </View>
          <SearchBox value={query} onChange={setQuery} placeholder="Search exercises" />
          <FilterChips label="Block type" value={blockType} onChange={setBlockType}
            options={[{ value: "", label: "All types" }, ...typesInUse.map((bt) => ({ value: bt, label: bt }))]} />
          <FilterChips label="Tier" value={tierFilter} onChange={setTierFilter} options={[
            { value: "", label: "All tiers" },
            ...settings.tierNames.filter(Boolean).map((tn) => ({ value: tn, label: tn, tier: tn })),
          ]} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <T small muted>{visible.length} exercise{visible.length === 1 ? "" : "s"}</T>
            {filtered && <LinkButton label="Clear filters" onPress={() => { setQuery(""); setBlockType(""); setTierFilter(""); }} />}
          </View>
          <FlatList data={visible} keyExtractor={(e) => String(e.row)} keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <Pressable accessibilityRole="button" onPress={() => pick("")}
                style={({ pressed }) => ({ minHeight: 48, justifyContent: "center", paddingHorizontal: 12, borderRadius: 10, backgroundColor: pressed || !value ? t.surface2 : "transparent" })}>
                <T muted>None — type it in myself</T>
              </Pressable>
            }
            ListEmptyComponent={<T muted style={{ textAlign: "center", marginTop: 20 }}>No exercises match.</T>}
            renderItem={({ item: e }) => {
              const on = e.name === value;
              const used = timesUsed(log, e.name);
              return (
                <Pressable accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => pick(e.name)}
                  style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 56, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: pressed || on ? t.surface2 : "transparent" })}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T bold={on} numberOfLines={1}>{e.name}</T>
                    <T small muted numberOfLines={1}>{[e.blockType, e.setsRepsDuration, used ? `used ${used}×` : ""].filter(Boolean).join(" · ")}</T>
                  </View>
                  <TierChip tier={e.tier} tierNames={settings.tierNames} />
                  {on && <Icon name="check" size={20} color={t.accent} />}
                </Pressable>
              );
            }} />
        </View>
      </Modal>
    </View>
  );
}
