import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { customAlphabet } from "nanoid";

const passphrase = customAlphabet(
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  32
);

export interface RelayConfig {
  publicHost: string;
  bindHost: string;
  ingestStartPort: number;
  egressStartPort: number;
  maxAllocations: number;
  latencyMs: number;
  pbkeylen: 16 | 24 | 32;
  autostartFfmpeg: boolean;
  ffmpegPath: string;
}

export interface RelayAllocation {
  participantId: string;
  ingestPort: number;
  egressPort: number;
  latencyMs: number;
  passphrase: string;
  pbkeylen: 16 | 24 | 32;
  participantPublishUrl: string;
  broadcasterPullUrl: string;
}

export class RelayManager {
  private readonly allocations = new Map<string, RelayAllocation>();
  private readonly processes = new Map<string, ChildProcessWithoutNullStreams>();
  private nextOffset = 0;

  constructor(private readonly config: RelayConfig) {}

  static fromEnv(env: NodeJS.ProcessEnv): RelayManager | undefined {
    const publicHost = env.COLLABVIEW_RELAY_PUBLIC_HOST?.trim();
    if (!publicHost) return undefined;

    return new RelayManager({
      publicHost,
      bindHost: env.COLLABVIEW_RELAY_BIND_HOST?.trim() || "0.0.0.0",
      ingestStartPort: parsePort(env.COLLABVIEW_RELAY_INGEST_START_PORT, 10000),
      egressStartPort: parsePort(env.COLLABVIEW_RELAY_EGRESS_START_PORT, 20000),
      maxAllocations: parsePort(env.COLLABVIEW_RELAY_MAX_ALLOCATIONS, 64),
      latencyMs: parsePort(env.COLLABVIEW_RELAY_LATENCY_MS, 500),
      pbkeylen: parsePbkeylen(env.COLLABVIEW_RELAY_PBKEYLEN),
      autostartFfmpeg: env.COLLABVIEW_RELAY_AUTOSTART_FFMPEG === "1",
      ffmpegPath: env.COLLABVIEW_RELAY_FFMPEG_PATH?.trim() || "ffmpeg"
    });
  }

  allocate(participantId: string): RelayAllocation {
    const existing = this.allocations.get(participantId);
    if (existing) return existing;

    if (this.allocations.size >= this.config.maxAllocations) {
      throw new Error("relay_full");
    }

    const offset = this.nextOffset;
    this.nextOffset += 1;
    const allocation = this.createAllocation(participantId, offset);
    this.allocations.set(participantId, allocation);
    if (this.config.autostartFfmpeg) {
      this.startFfmpegRelay(allocation);
    }
    return allocation;
  }

  get(participantId: string): RelayAllocation | undefined {
    return this.allocations.get(participantId);
  }

  stop(participantId: string): void {
    this.allocations.delete(participantId);
    const process = this.processes.get(participantId);
    if (process) {
      process.kill("SIGTERM");
      this.processes.delete(participantId);
    }
  }

  private createAllocation(participantId: string, offset: number): RelayAllocation {
    const ingestPort = this.config.ingestStartPort + offset;
    const egressPort = this.config.egressStartPort + offset;
    const secret = passphrase();
    const common = {
      latencyMs: this.config.latencyMs,
      passphrase: secret,
      pbkeylen: this.config.pbkeylen
    };

    return {
      participantId,
      ingestPort,
      egressPort,
      ...common,
      participantPublishUrl: srtUrl(this.config.publicHost, ingestPort, "caller", common),
      broadcasterPullUrl: srtUrl(this.config.publicHost, egressPort, "caller", common)
    };
  }

  private startFfmpegRelay(allocation: RelayAllocation): void {
    const inputUrl = srtUrl(this.config.bindHost, allocation.ingestPort, "listener", allocation);
    const outputUrl = srtUrl(this.config.bindHost, allocation.egressPort, "listener", allocation);
    const process = spawn(
      this.config.ffmpegPath,
      [
        "-hide_banner",
        "-loglevel",
        "warning",
        "-fflags",
        "nobuffer",
        "-i",
        inputUrl,
        "-map",
        "0:v:0",
        "-c",
        "copy",
        "-an",
        "-f",
        "mpegts",
        outputUrl
      ],
      { shell: false }
    );
    process.stderr.on("data", (chunk: Buffer) => {
      console.warn(`relay ffmpeg ${allocation.participantId}: ${sanitizeLog(chunk.toString())}`);
    });
    process.on("exit", () => {
      this.processes.delete(allocation.participantId);
    });
    this.processes.set(allocation.participantId, process);
  }
}

export function publicRelayAllocation(allocation: RelayAllocation) {
  return {
    participantId: allocation.participantId,
    ingestPort: allocation.ingestPort,
    egressPort: allocation.egressPort,
    latencyMs: allocation.latencyMs,
    pbkeylen: allocation.pbkeylen,
    participantPublishUrl: allocation.participantPublishUrl,
    broadcasterPullUrl: allocation.broadcasterPullUrl
  };
}

function srtUrl(
  host: string,
  port: number,
  mode: "caller" | "listener",
  options: { latencyMs: number; passphrase: string; pbkeylen: 16 | 24 | 32 }
): string {
  const query = new URLSearchParams({
    mode,
    latency: String(options.latencyMs * 1000),
    transtype: "live",
    passphrase: options.passphrase,
    pbkeylen: String(options.pbkeylen)
  });
  return `srt://${host}:${port}?${query.toString()}`;
}

function parsePort(value: string | undefined, fallback: number): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) return fallback;
  return parsed;
}

function parsePbkeylen(value: string | undefined): 16 | 24 | 32 {
  const parsed = Number(value ?? 16);
  if (parsed === 24 || parsed === 32) return parsed;
  return 16;
}

function sanitizeLog(line: string): string {
  return line.replace(/passphrase=[^&\s]+/g, "passphrase=***");
}
