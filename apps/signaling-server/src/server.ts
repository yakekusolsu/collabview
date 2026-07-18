import websocket from "@fastify/websocket";
import Fastify from "fastify";
import { RoomRegistry } from "./rooms";

const registry = new RoomRegistry();
const server = Fastify({ logger: true });

await server.register(websocket);

server.post("/rooms", async () => {
  const room = registry.createRoom();
  return {
    roomCode: room.code,
    tokenExpiresAt: room.expiresAt
  };
});

server.post("/rooms/join", async (request, reply) => {
  try {
    const participant = registry.joinRoom(request.body, request.ip);
    return {
      participantId: participant.id,
      tokenExpiresAt: participant.joinedAt + 30 * 60 * 1000
    };
  } catch (error) {
    request.log.warn({ error }, "room join failed");
    return reply.code(400).send({ error: "join_failed" });
  }
});

server.get("/health", async () => ({ ok: true }));

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 8787);
  await server.listen({ host: "127.0.0.1", port });
}

export { server };
