import { customAlphabet } from "nanoid";
import { z } from "zod";
import { DISPLAY_NAME_MAX_LENGTH } from "@collabview/protocol";
import { publicRelayAllocation, type RelayAllocation, type RelayManager } from "./relay";

const roomCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);
const token = customAlphabet("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 32);
const ROOM_TTL_MS = 30 * 60 * 1000;
const MAX_PARTICIPANTS = 4;

export const joinRoomSchema = z.object({
  roomCode: z.string().regex(/^[A-Z2-9]{6}$/),
  displayName: z.string().trim().min(1).max(DISPLAY_NAME_MAX_LENGTH)
});

export const createRoomSchema = z.object({
  transportMode: z.enum(["lan", "relay"]).default("lan"),
  hostAddress: z.string().trim().min(1).max(255).optional(),
  hostPort: z.number().int().min(1).max(65535).optional()
});

export interface HostEndpoint {
  hostAddress: string;
  hostPort: number;
}

export type TransportMode = "lan" | "relay";

export interface RoomParticipant {
  id: string;
  displayName: string;
  token: string;
  joinedAt: number;
  relayAllocation?: RelayAllocation;
}

export interface Room {
  code: string;
  hostToken: string;
  transportMode: TransportMode;
  hostEndpoint?: HostEndpoint;
  expiresAt: number;
  participants: Map<string, RoomParticipant>;
}

export class RoomRegistry {
  private readonly rooms = new Map<string, Room>();
  private readonly attempts = new Map<string, number[]>();

  constructor(private readonly relayManager?: RelayManager) {}

  createRoom(input: unknown, remoteAddress: string, now = Date.now()): Room {
    this.cleanup(now);
    const parsed = createRoomSchema.parse(input);
    if (parsed.transportMode === "lan" && !parsed.hostPort) {
      throw new Error("host_port_required");
    }
    if (parsed.transportMode === "relay" && !this.relayManager) {
      throw new Error("relay_unavailable");
    }
    let code = roomCode();
    while (this.rooms.has(code)) {
      code = roomCode();
    }
    const room: Room = {
      code,
      hostToken: token(),
      transportMode: parsed.transportMode,
      hostEndpoint:
        parsed.transportMode === "lan"
          ? {
              hostAddress: parsed.hostAddress ?? normalizeRemoteAddress(remoteAddress),
              hostPort: parsed.hostPort as number
            }
          : undefined,
      expiresAt: now + ROOM_TTL_MS,
      participants: new Map()
    };
    this.rooms.set(code, room);
    return room;
  }

  joinRoom(input: unknown, remoteAddress: string, now = Date.now()): RoomParticipant {
    this.cleanup(now);
    this.recordAttempt(remoteAddress, now);
    const attempts = this.attempts.get(remoteAddress) ?? [];
    if (attempts.length > 20) {
      throw new Error("too_many_attempts");
    }

    const parsed = joinRoomSchema.parse(input);
    const room = this.rooms.get(parsed.roomCode);
    if (!room) throw new Error("room_not_found");
    if (room.participants.size >= MAX_PARTICIPANTS) throw new Error("room_full");

    const participant: RoomParticipant = {
      id: token(),
      displayName: parsed.displayName,
      token: token(),
      joinedAt: now
    };
    if (room.transportMode === "relay") {
      participant.relayAllocation = this.relayManager?.allocate(participant.id);
      if (!participant.relayAllocation) throw new Error("relay_unavailable");
    }
    room.participants.set(participant.id, participant);
    return participant;
  }

  getRoomEndpoint(roomCode: string, now = Date.now()): HostEndpoint {
    this.cleanup(now);
    const room = this.rooms.get(roomCode);
    if (!room) throw new Error("room_not_found");
    if (!room.hostEndpoint) throw new Error("room_has_no_lan_endpoint");
    return room.hostEndpoint;
  }

  listParticipants(input: unknown, now = Date.now()): ReturnType<typeof publicParticipant>[] {
    this.cleanup(now);
    const parsed = listParticipantsSchema.parse(input);
    const room = this.rooms.get(parsed.roomCode);
    if (!room) throw new Error("room_not_found");
    if (room.hostToken !== parsed.hostToken) throw new Error("invalid_host_token");
    return [...room.participants.values()].map(publicParticipant);
  }

  cleanup(now = Date.now()): void {
    for (const [code, room] of this.rooms.entries()) {
      if (room.expiresAt <= now) this.rooms.delete(code);
    }
    for (const [address, timestamps] of this.attempts.entries()) {
      const fresh = timestamps.filter((timestamp) => now - timestamp < 60_000);
      if (fresh.length === 0) this.attempts.delete(address);
      else this.attempts.set(address, fresh);
    }
  }

  private recordAttempt(remoteAddress: string, now: number): void {
    const attempts = this.attempts.get(remoteAddress) ?? [];
    attempts.push(now);
    this.attempts.set(remoteAddress, attempts);
  }
}

export const listParticipantsSchema = z.object({
  roomCode: z.string().regex(/^[A-Z2-9]{6}$/),
  hostToken: z.string().min(16).max(128)
});

function publicParticipant(participant: RoomParticipant) {
  return {
    participantId: participant.id,
    displayName: participant.displayName,
    joinedAt: participant.joinedAt,
    relay: participant.relayAllocation
      ? publicRelayAllocation(participant.relayAllocation)
      : undefined
  };
}

function normalizeRemoteAddress(remoteAddress: string): string {
  if (remoteAddress.startsWith("::ffff:")) return remoteAddress.replace("::ffff:", "");
  if (remoteAddress === "::1") return "127.0.0.1";
  return remoteAddress;
}
