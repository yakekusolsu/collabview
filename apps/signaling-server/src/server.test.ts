import { afterAll, describe, expect, it } from "vitest";
import { server } from "./server";

describe("signaling server", () => {
  afterAll(async () => {
    await server.close();
  });

  it("creates a room code and resolves the broadcaster endpoint on join", async () => {
    const createResponse = await server.inject({
      method: "POST",
      url: "/rooms",
      payload: {
        hostAddress: "192.168.0.10",
        hostPort: 12001
      }
    });

    expect(createResponse.statusCode).toBe(200);
    const created = createResponse.json<{ roomCode: string; tokenExpiresAt: number }>();
    expect(created.roomCode).toMatch(/^[A-Z2-9]{6}$/);

    const joinResponse = await server.inject({
      method: "POST",
      url: "/rooms/join",
      payload: {
        roomCode: created.roomCode,
        displayName: "Player 1"
      }
    });

    expect(joinResponse.statusCode).toBe(200);
    expect(
      joinResponse.json<{
        participantId: string;
        hostAddress: string;
        hostPort: number;
        tokenExpiresAt: number;
      }>()
    ).toMatchObject({
      hostAddress: "192.168.0.10",
      hostPort: 12001
    });
  }, 15_000);
});
