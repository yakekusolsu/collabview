import { customAlphabet } from "nanoid";
import { z } from "zod";
import { DISPLAY_NAME_MAX_LENGTH } from "@collabview/protocol";

const roomCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);
const token = customAlphabet("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 32);
const ROOM_TTL_MS = 30 * 60 * 1000;
const MAX_PARTICIPANTS = 4;

export const joinRoomSchema = z.object({
  roomCode: z.string().regex(/^[A-Z2-9]{6}$/),
  displayName: z.string().trim().min(1).max(DISPLAY_NAME_MAX_LENGTH)
});

export interface RoomParticipant {
  id: string;
  displayName: string;
  token: string;
  joinedAt: number;
}

export interface Room {
  code: string;
  hostToken: string;
  expiresAt: number;
  participants: Map<string, RoomParticipant>;
}

export class RoomRegistry {
  private readonly rooms = new Map<string, Room>();
  private readonly attempts = new Map<string, number[]>();

  createRoom(now = Date.now()): Room {
    this.cleanup(now);
    let code = roomCode();
    while (this.rooms.has(code)) {
      code = roomCode();
    }
    const room: Room = {
      code,
      hostToken: token(),
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
    room.participants.set(participant.id, participant);
    return participant;
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
