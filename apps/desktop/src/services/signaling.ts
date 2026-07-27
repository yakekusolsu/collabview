export interface CreateRoomCodeRequest {
  signalingUrl: string;
  transportMode: "lan" | "relay";
  hostAddress: string;
  hostPort: number;
}

export interface CreateRoomCodeResult {
  roomCode: string;
  hostToken: string;
  transportMode: "lan" | "relay";
  tokenExpiresAt: number;
}

export interface JoinRoomCodeRequest {
  signalingUrl: string;
  roomCode: string;
  displayName: string;
}

export interface JoinRoomCodeResult {
  participantId: string;
  transportMode: "lan" | "relay";
  hostAddress: string;
  hostPort: number;
  participantPublishUrl?: string;
  tokenExpiresAt: number;
}

export interface RelayEndpoint {
  participantId: string;
  ingestPort: number;
  egressPort: number;
  latencyMs: number;
  pbkeylen: 16 | 24 | 32;
  participantPublishUrl: string;
  broadcasterPullUrl: string;
}

export interface RoomParticipantConnection {
  participantId: string;
  displayName: string;
  joinedAt: number;
  relay?: RelayEndpoint;
}

export interface ListRoomParticipantsResult {
  participants: RoomParticipantConnection[];
}

export async function createRoomCode(
  request: CreateRoomCodeRequest
): Promise<CreateRoomCodeResult> {
  const response = await fetch(`${normalizeSignalingUrl(request.signalingUrl)}/rooms`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      transportMode: request.transportMode,
      hostAddress: request.hostAddress.trim(),
      hostPort: request.hostPort
    })
  });
  return readJson<CreateRoomCodeResult>(response, "参加コードを発行できませんでした。");
}

export async function joinRoomCode(request: JoinRoomCodeRequest): Promise<JoinRoomCodeResult> {
  const response = await fetch(`${normalizeSignalingUrl(request.signalingUrl)}/rooms/join`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      roomCode: request.roomCode.trim().toUpperCase(),
      displayName: request.displayName.trim()
    })
  });
  return readJson<JoinRoomCodeResult>(response, "参加コードから接続先を取得できませんでした。");
}

export async function listRoomParticipants(
  signalingUrl: string,
  roomCode: string,
  hostToken: string
): Promise<ListRoomParticipantsResult> {
  const url = new URL(`${normalizeSignalingUrl(signalingUrl)}/rooms/${roomCode}/participants`);
  url.searchParams.set("hostToken", hostToken);
  const response = await fetch(url);
  return readJson<ListRoomParticipantsResult>(response, "参加者一覧を取得できませんでした。");
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

function normalizeSignalingUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) throw new Error("シグナリングサーバーURLを入力してください。");
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

async function readJson<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    const body = await safeReadJson(response);
    const code = typeof body?.error === "string" ? body.error : response.statusText;
    throw new Error(`${fallbackMessage} (${code})`);
  }
  return (await response.json()) as T;
}

async function safeReadJson(response: Response): Promise<{ error?: unknown } | null> {
  try {
    return (await response.json()) as { error?: unknown };
  } catch {
    return null;
  }
}
