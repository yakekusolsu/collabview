import websocket from "@fastify/websocket";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { RoomRegistry } from "./rooms";
import { RelayManager, publicRelayAllocation } from "./relay";

const relayManager = RelayManager.fromEnv(process.env);
const registry = new RoomRegistry(relayManager);
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
      hostToken: room.hostToken,
      transportMode: room.transportMode,
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
    const endpoint = participant.relayAllocation ? undefined : registry.getRoomEndpoint(roomCode);
    const relay = participant.relayAllocation
      ? publicRelayAllocation(participant.relayAllocation)
      : undefined;
    return {
      participantId: participant.id,
      transportMode: relay ? "relay" : "lan",
      hostAddress: endpoint?.hostAddress ?? "",
      hostPort: endpoint?.hostPort ?? 0,
      participantPublishUrl: relay?.participantPublishUrl,
      tokenExpiresAt: participant.joinedAt + 30 * 60 * 1000
    };
  } catch (error) {
    request.log.warn({ error }, "room join failed");
    return reply.code(400).send({ error: "join_failed" });
  }
});

server.get("/rooms/:roomCode/participants", async (request, reply) => {
  try {
    const params = request.params as { roomCode: string };
    const query = request.query as { hostToken?: string };
    return {
      participants: registry.listParticipants({
        roomCode: params.roomCode,
        hostToken: query.hostToken ?? ""
      })
    };
  } catch (error) {
    request.log.warn({ error }, "participant list failed");
    return reply.code(403).send({ error: "participant_list_failed" });
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
  return [
    "tauri://localhost",
    "http://tauri.localhost",
    "https://tauri.localhost",
    "http://127.0.0.1:1420",
    "http://localhost:1420"
  ];
}

function extractRoomCode(body: unknown): string {
  if (!body || typeof body !== "object") throw new Error("invalid_join_request");
  const value = (body as { roomCode?: unknown }).roomCode;
  if (typeof value !== "string") throw new Error("invalid_join_request");
  return value.trim().toUpperCase();
}
