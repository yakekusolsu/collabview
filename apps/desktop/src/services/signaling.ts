import type {
  CreateRoomCodeRequest,
  CreateRoomCodeResult,
  JoinRoomCodeRequest,
  JoinRoomCodeResult,
  ListRoomParticipantsResult
} from "@collabview/shared-types";
import { tauriApi } from "@/services/tauri";

export async function createRoomCode(
  request: CreateRoomCodeRequest
): Promise<CreateRoomCodeResult> {
  return tauriApi.createRoomCode(request);
}

export async function joinRoomCode(request: JoinRoomCodeRequest): Promise<JoinRoomCodeResult> {
  return tauriApi.joinRoomCode(request);
}

export async function listRoomParticipants(
  signalingUrl: string,
  roomCode: string,
  hostToken: string
): Promise<ListRoomParticipantsResult> {
  return tauriApi.listRoomParticipants({ signalingUrl, roomCode, hostToken });
}

export function parseSrtUrlEndpoint(url: string): { host: string; port: number } {
  const parsed = new URL(url);
  if (parsed.protocol !== "srt:") throw new Error("SRT URLではありません。");
  const port = Number(parsed.port);
  if (!parsed.hostname || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SRT URLの接続先が無効です。");
  }
  return {
    host: parsed.hostname,
    port
  };
}
