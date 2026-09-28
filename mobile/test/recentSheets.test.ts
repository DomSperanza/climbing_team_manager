import { describe, expect, it } from "vitest";
import { forget, parseKnown, remember, sheetFromAppLink } from "../src/core/recentSheets";

describe("remembered Sheets", () => {
  it("keeps the most recent first, without duplicates, up to five", () => {
    let list = parseKnown(null);
    list = remember(list, { id: "a", title: "Rock Team 2025–26" }, 1);
    list = remember(list, { id: "b", title: "Rock Team 2026–27" }, 2);
    list = remember(list, { id: "a", title: "Rock Team 2025–26" }, 3);
    expect(list.map((s) => s.id)).toEqual(["a", "b"]);
    for (let i = 0; i < 10; i++) list = remember(list, { id: "x" + i, title: "t" }, 10 + i);
    expect(list).toHaveLength(5);
    expect(forget(list, "x9").map((s) => s.id)).not.toContain("x9");
  });

  it("ignores anything unreadable", () => {
    expect(parseKnown("not json")).toEqual([]);
    expect(parseKnown('[{"id":1},{"id":"ok","title":"T","lastUsed":1}]')).toEqual([{ id: "ok", title: "T", lastUsed: 1 }]);
  });

  it("reads the Sheet from an invite link", () => {
    expect(sheetFromAppLink("?sheet=1AbCdEfGhIjKlMnOpQrStUvWxYz")).toBe("1AbCdEfGhIjKlMnOpQrStUvWxYz");
    expect(sheetFromAppLink("?sheet=short")).toBeNull();
    expect(sheetFromAppLink("")).toBeNull();
  });
});
