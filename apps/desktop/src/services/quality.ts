import type { QualityPreset } from "@collabview/shared-types";

export const qualityPresets: QualityPreset[] = [
  {
    id: "light",
    label: "軽量",
    width: 1280,
    height: 720,
    fps: 30,
    bitrateKbps: 4000,
    keyframeSeconds: 2,
    latencyMs: 250,
    codec: "h264",
    encoder: "h264_videotoolbox"
  },
  {
    id: "standard",
    label: "標準",
    width: 1280,
    height: 720,
    fps: 60,
    bitrateKbps: 8000,
    keyframeSeconds: 2,
    latencyMs: 250,
    codec: "h264",
    encoder: "h264_videotoolbox"
  },
  {
    id: "high",
    label: "高画質",
    width: 1920,
    height: 1080,
    fps: 60,
    bitrateKbps: 12000,
    keyframeSeconds: 2,
    latencyMs: 500,
    codec: "h264",
    encoder: "h264_videotoolbox"
  },
  {
    id: "ultra",
    label: "超高画質",
    width: 1920,
    height: 1080,
    fps: 60,
    bitrateKbps: 20000,
    keyframeSeconds: 2,
    latencyMs: 500,
    codec: "h264",
    encoder: "h264_videotoolbox"
  },
  {
    id: "custom",
    label: "カスタム",
    width: 1280,
    height: 720,
    fps: 60,
    bitrateKbps: 8000,
    keyframeSeconds: 2,
    latencyMs: 250,
    codec: "h264",
    encoder: "h264_videotoolbox"
  }
];

export function findQualityPreset(id: QualityPreset["id"]): QualityPreset {
  const fallback = qualityPresets.find((preset) => preset.id === "standard");
  if (!fallback) {
    throw new Error("standard quality preset is missing");
  }
  return qualityPresets.find((preset) => preset.id === id) ?? fallback;
}
