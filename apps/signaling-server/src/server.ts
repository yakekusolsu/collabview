import websocket from "@fastify/websocket";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { RoomRegistry } from "./rooms";

const registry = new RoomRegistry();
const server = Fastify({ logger: true });

await server.register(cors, {
  origin: allowedOrigins(),
  methods: ["GET", "POST"]
});
await server.register(websocket);

server.post("/rooms", async (request, reply) => {
  try {
    const room = registry.createRoom(request.body, request.ip);
    return {
      roomCode: room.code,
      tokenExpiresAt: room.expiresAt
    };
  } catch (error) {
    request.log.warn({ error }, "room creation failed");
    return reply.code(400).send({ error: "room_creation_failed" });
  }
});

server.post("/rooms/join", async (request, reply) => {
  try {
    const participant = registry.joinRoom(request.body, request.ip);
    const roomCode = extractRoomCode(request.body);
    const endpoint = registry.getRoomEndpoint(roomCode);
    return {
      participantId: participant.id,
      hostAddress: endpoint.hostAddress,
      hostPort: endpoint.hostPort,
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
  const host = process.env.HOST ?? "127.0.0.1";
  await server.listen({ host, port });
}

export { server };

function allowedOrigins(): string[] {
  const configured = process.env.COLLABVIEW_ALLOWED_ORIGINS;
  if (configured) {
    return configured
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);
  }
  return ["tauri://localhost", "http://127.0.0.1:1420", "http://localhost:1420"];
}

function extractRoomCode(body: unknown): string {
  if (!body || typeof body !== "object") throw new Error("invalid_join_request");
  const value = (body as { roomCode?: unknown }).roomCode;
  if (typeof value !== "string") throw new Error("invalid_join_request");
  return value.trim().toUpperCase();
}
