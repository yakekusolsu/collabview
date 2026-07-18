export interface CreateRoomCodeRequest {
  signalingUrl: string;
  hostAddress: string;
  hostPort: number;
}

export interface CreateRoomCodeResult {
  roomCode: string;
  tokenExpiresAt: number;
}

export interface JoinRoomCodeRequest {
  signalingUrl: string;
  roomCode: string;
  displayName: string;
}

export interface JoinRoomCodeResult {
  participantId: string;
  hostAddress: string;
  hostPort: number;
  tokenExpiresAt: number;
}

export async function createRoomCode(
  request: CreateRoomCodeRequest
): Promise<CreateRoomCodeResult> {
  const response = await fetch(`${normalizeSignalingUrl(request.signalingUrl)}/rooms`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
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
