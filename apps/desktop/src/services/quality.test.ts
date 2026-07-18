import { describe, expect, it } from "vitest";
import { findQualityPreset } from "./quality";

describe("quality presets", () => {
  it("uses standard as the fallback preset", () => {
    expect(findQualityPreset("custom").label).toBe("カスタム");
  });

  it("keeps the standard preset at 720p60", () => {
    const standard = findQualityPreset("standard");
    expect(standard.width).toBe(1280);
    expect(standard.fps).toBe(60);
  });
});
