import { vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (command: string) => {
    if (command === "list_capture_sources") {
      return [
        {
          id: "display:1",
          name: "Main Display",
          kind: "display",
          width: 1920,
          height: 1080
        },
        {
          id: "window:1",
          name: "Game Window",
          kind: "window",
          width: 1280,
          height: 720
        }
      ];
    }
    if (command === "capture_frame") {
      return {
        path: "/tmp/CollabView/frames/test.png",
        width: 1280,
        height: 720,
        timestampNs: 1
      };
    }
    if (command === "load_settings") {
      return {
        obs: {
          host: "127.0.0.1",
          port: 4455,
          passwordConfigured: false,
          autoConnect: false,
          autoReconnect: true
        }
      };
    }
    return null;
  })
}));
