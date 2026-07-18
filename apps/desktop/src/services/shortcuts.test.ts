import { describe, expect, it } from "vitest";
import { shortcutBindings } from "./shortcuts";

describe("shortcutBindings", () => {
  it("maps configured shortcuts to OBS actions", () => {
    const bindings = shortcutBindings({
      selfView: "Command+1",
      player1: "Command+2",
      player2: "Command+3",
      player3: "Command+4",
      split2: "Command+5",
      split4: "Command+6"
    });

    expect(bindings).toEqual([
      { shortcut: "Command+1", action: "self" },
      { shortcut: "Command+2", action: "player1" },
      { shortcut: "Command+3", action: "player2" },
      { shortcut: "Command+4", action: "player3" },
      { shortcut: "Command+5", action: "split2" },
      { shortcut: "Command+6", action: "split4" }
    ]);
  });

  it("skips empty shortcuts", () => {
    const bindings = shortcutBindings({
      selfView: "",
      player1: "Command+2",
      player2: "",
      player3: "",
      split2: "Command+5",
      split4: ""
    });

    expect(bindings).toEqual([
      { shortcut: "Command+2", action: "player1" },
      { shortcut: "Command+5", action: "split2" }
    ]);
  });
});
