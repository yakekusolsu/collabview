import { register, unregisterAll } from "@tauri-apps/plugin-global-shortcut";
import type { ShortcutSettings } from "@collabview/shared-types";

export type ShortcutAction = "self" | "player1" | "player2" | "player3" | "split2" | "split4";

export interface ShortcutBinding {
  shortcut: string;
  action: ShortcutAction;
}

export function shortcutBindings(settings: ShortcutSettings): ShortcutBinding[] {
  const bindings: ShortcutBinding[] = [
    { shortcut: settings.selfView, action: "self" },
    { shortcut: settings.player1, action: "player1" },
    { shortcut: settings.player2, action: "player2" },
    { shortcut: settings.player3, action: "player3" },
    { shortcut: settings.split2, action: "split2" },
    { shortcut: settings.split4, action: "split4" }
  ];
  return bindings.filter((binding) => binding.shortcut.trim().length > 0);
}

export async function registerCollabViewShortcuts(
  settings: ShortcutSettings,
  onAction: (action: ShortcutAction) => void
): Promise<void> {
  const bindings = shortcutBindings(settings);
  const shortcutToAction = new Map(bindings.map((binding) => [binding.shortcut, binding.action]));
  await unregisterAll();
  await register(
    bindings.map((binding) => binding.shortcut),
    (event) => {
      if (event.state !== "Pressed") return;
      const action = shortcutToAction.get(event.shortcut);
      if (action) onAction(action);
    }
  );
}

export async function unregisterCollabViewShortcuts(): Promise<void> {
  await unregisterAll();
}
