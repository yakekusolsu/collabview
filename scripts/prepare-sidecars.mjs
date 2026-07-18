import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tauriDir = join(rootDir, "apps", "desktop", "src-tauri");
const binDir = join(tauriDir, "binaries");
const triple = process.env.COLLABVIEW_TARGET_TRIPLE ?? rustHostTriple();
const isWindowsTarget = triple.includes("windows");
const isDarwinTarget = triple.includes("apple-darwin");
const sidecarExtension = isWindowsTarget ? ".exe" : "";
const ffmpegName = `ffmpeg-${triple}${sidecarExtension}`;
const ffmpegPath = join(binDir, ffmpegName);

mkdirSync(binDir, { recursive: true });

if (isDarwinTarget) {
  prepareCaptureHelper();
} else {
  console.log(`Skipping ScreenCaptureKit helper for ${triple}.`);
}

if (!existsSync(ffmpegPath)) {
  prepareFfmpeg();
} else {
  console.log(`FFmpeg sidecar already exists: ${ffmpegPath}`);
}

verifyFfmpeg(ffmpegPath);

function rustHostTriple() {
  const result = spawnSync("rustc", ["-vV"], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`rustc -vV failed: ${result.stderr}`);
  }
  const host = result.stdout
    .split("\n")
    .find((line) => line.startsWith("host:"))
    ?.replace("host:", "")
    .trim();
  if (!host) throw new Error("Could not detect Rust host triple.");
  return host;
}

function prepareCaptureHelper() {
  const helperSrc = join(rootDir, "apps", "capture-helper");
  const helperName = `collabview-capture-helper-${triple}`;
  console.log(`Building ScreenCaptureKit helper for ${triple}`);
  run("swift", [
    "build",
    "--package-path",
    helperSrc,
    "-c",
    "release",
    "-Xswiftc",
    "-parse-as-library"
  ]);
  const builtHelper = join(helperSrc, ".build", "release", "collabview-capture-helper");
  copyFileSync(builtHelper, join(binDir, helperName));
}

function prepareFfmpeg() {
  if (triple === "aarch64-apple-darwin" && process.env.COLLABVIEW_BUILD_FFMPEG !== "0") {
    run("bash", [join(rootDir, "scripts", "build-minimal-ffmpeg-sidecar.sh")]);
    return;
  }

  if (triple === "aarch64-apple-darwin") {
    run("bash", [join(rootDir, "scripts", "download-ffmpeg-sidecar.sh")]);
    return;
  }

  if (isWindowsTarget) {
    const configuredPath = process.env.COLLABVIEW_WINDOWS_FFMPEG_PATH;
    const sourcePath =
      configuredPath && existsSync(configuredPath) ? configuredPath : findWindowsFfmpeg();
    if (!sourcePath) {
      throw new Error(
        `No Windows FFmpeg sidecar was found. Place an executable at ${ffmpegPath}, set COLLABVIEW_WINDOWS_FFMPEG_PATH, or install ffmpeg on PATH.`
      );
    }
    copyFileSync(sourcePath, ffmpegPath);
    console.log(`Copied Windows FFmpeg sidecar from ${sourcePath}`);
    return;
  }

  throw new Error(`No FFmpeg sidecar preparation is configured for ${triple}.`);
}

function findWindowsFfmpeg() {
  const candidates = [
    "C:\\ProgramData\\chocolatey\\lib\\ffmpeg\\tools\\ffmpeg\\bin\\ffmpeg.exe",
    "C:\\ffmpeg\\bin\\ffmpeg.exe"
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  const command = process.platform === "win32" ? "where.exe" : "which";
  const result = spawnSync(command, ["ffmpeg"], { encoding: "utf8" });
  if (result.status !== 0) return null;
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0 && existsSync(line) && statSync(line).isFile());
}

function verifyFfmpeg(executablePath) {
  const version = runCapture(executablePath, ["-version"]);
  const protocols = runCapture(executablePath, ["-hide_banner", "-protocols"]);
  const encoders = runCapture(executablePath, ["-hide_banner", "-encoders"]);
  const decoders = runCapture(executablePath, ["-hide_banner", "-decoders"]);
  const devices = runCapture(executablePath, ["-hide_banner", "-devices"]);
  const requiredEncoder = isWindowsTarget ? "libx264" : "h264_videotoolbox";

  console.log(version.split(/\r?\n/)[0]);
  requireText(protocols, "srt", "FFmpeg sidecar does not expose the SRT protocol.");
  requireText(encoders, requiredEncoder, `FFmpeg sidecar does not expose ${requiredEncoder}.`);
  requireText(encoders, "mjpeg", "FFmpeg sidecar does not expose the MJPEG encoder for previews.");
  requireText(decoders, "h264", "FFmpeg sidecar does not expose the H.264 decoder for previews.");
  requireText(devices, "lavfi", "FFmpeg sidecar does not expose lavfi for loopback tests.");
  console.log(
    `FFmpeg sidecar supports SRT, ${requiredEncoder}, H.264 preview decode, and lavfi loopback tests.`
  );
}

function requireText(haystack, needle, message) {
  if (!haystack.includes(needle)) {
    throw new Error(message);
  }
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", cwd: rootDir });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
}

function runCapture(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed: ${result.stderr}`);
  }
  return `${result.stdout}\n${result.stderr}`;
}
