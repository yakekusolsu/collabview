export const ROOM_CODE_PATTERN = /^[A-Z2-9]{6}$/;
export const DISPLAY_NAME_MAX_LENGTH = 32;
export const DEFAULT_HOST_PORT = 12000;
export const DEFAULT_LOCAL_OUTPUT_START_PORT = 12001;
export const DEFAULT_LOCAL_OUTPUT_END_PORT = 12100;

export function isValidRoomCode(value: string): boolean {
  return ROOM_CODE_PATTERN.test(value.trim().toUpperCase());
}

export function sanitizeDisplayName(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, DISPLAY_NAME_MAX_LENGTH);
}

export function latencyMsToFfmpegSrtMicros(latencyMs: number): number {
  if (!Number.isFinite(latencyMs) || latencyMs < 0) {
    throw new Error("SRT latency must be a non-negative number");
  }
  return Math.round(latencyMs * 1000);
}
