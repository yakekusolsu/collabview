import { describe, expect, it } from "vitest";
import { RoomRegistry } from "./rooms";

describe("RoomRegistry", () => {
  it("creates joinable rooms with expiring tokens", () => {
    const registry = new RoomRegistry();
    const room = registry.createRoom({ hostAddress: "192.168.0.10", hostPort: 12001 }, "127.0.0.1", 1000);
    const participant = registry.joinRoom(
      { roomCode: room.code, displayName: "Player 1" },
      "127.0.0.1",
      1100
    );
    expect(participant.displayName).toBe("Player 1");
    expect(participant.token).toHaveLength(32);
    expect(registry.getRoomEndpoint(room.code, 1200)).toEqual({
      hostAddress: "192.168.0.10",
      hostPort: 12001
    });
  });

  it("rate limits repeated invalid joins", () => {
    const registry = new RoomRegistry();
    expect(() => {
      for (let index = 0; index < 22; index += 1) {
        registry.joinRoom({ roomCode: "ABC234", displayName: "Player" }, "10.0.0.2", 1000 + index);
      }
    }).toThrow();
  });
});
