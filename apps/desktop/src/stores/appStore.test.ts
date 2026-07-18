import { setActivePinia, createPinia } from "pinia";
import { describe, expect, it, beforeEach } from "vitest";
import { useAppStore } from "./appStore";

describe("appStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("adds participants with unique local SRT ports", () => {
    const store = useAppStore();
    store.addLocalParticipant();
    store.addLocalParticipant();
    expect(store.participants.map((participant) => participant.port)).toEqual([12001, 12002]);
  });

  it("loads settings from the backend", async () => {
    const store = useAppStore();
    await store.load();
    expect(store.settings.obs.host).toBe("127.0.0.1");
  });
});
