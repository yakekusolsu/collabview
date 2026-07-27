import { describe, expect, it } from "vitest";
import { RoomRegistry } from "./rooms";
import { RelayManager } from "./relay";

describe("RoomRegistry", () => {
  it("creates joinable rooms with expiring tokens", () => {
    const registry = new RoomRegistry();
    const room = registry.createRoom(
      { hostAddress: "192.168.0.10", hostPort: 12001 },
      "127.0.0.1",
      1000
    );
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

  it("allocates relay endpoints for internet participants", () => {
    const registry = new RoomRegistry(
      new RelayManager({
        publicHost: "relay.example.com",
        bindHost: "0.0.0.0",
        ingestStartPort: 10000,
        egressStartPort: 20000,
        maxAllocations: 4,
        latencyMs: 500,
        pbkeylen: 16,
        autostartFfmpeg: false,
        ffmpegPath: "ffmpeg"
      })
    );
    const room = registry.createRoom({ transportMode: "relay" }, "127.0.0.1", 1000);
    const participant = registry.joinRoom(
      { roomCode: room.code, displayName: "Tokyo" },
      "203.0.113.10",
      1100
    );
    expect(participant.relayAllocation?.participantPublishUrl).toContain(
      "srt://relay.example.com:10000"
    );
    expect(participant.relayAllocation?.broadcasterPullUrl).toContain(
      "srt://relay.example.com:20000"
    );
    expect(
      registry.listParticipants(
        {
          roomCode: room.code,
          hostToken: room.hostToken
        },
        1200
      )
    ).toMatchObject([
      {
        displayName: "Tokyo",
        relay: {
          ingestPort: 10000,
          egressPort: 20000
        }
      }
    ]);
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
