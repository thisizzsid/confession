import { describe, it, expect } from "vitest";
import { extractHashtags, normalizeGeoPoint } from "./utils";

describe("extractHashtags", () => {
  it("should extract multiple hashtags from text", () => {
    const text = "Hello #world this is a #test";
    const result = extractHashtags(text);
    expect(result).toEqual(["#world", "#test"]);
  });

  it("should return an empty array if no hashtags are present", () => {
    const text = "Hello world this is a test";
    const result = extractHashtags(text);
    expect(result).toEqual([]);
  });

  it("should handle hashtags with underscores", () => {
    const text = "Check this #cool_feature out!";
    const result = extractHashtags(text);
    expect(result).toEqual(["#cool_feature"]);
  });

  it("should handle non-English hashtags (e.g., Hebrew)", () => {
    const text = "שלום #עולם";
    const result = extractHashtags(text);
    expect(result).toEqual(["#עולם"]);
  });

  it("should normalize a latitude/longitude pair to map coordinates", () => {
    const result = normalizeGeoPoint(40.7128, -74.0060);

    expect(result.x).toBeGreaterThanOrEqual(0);
    expect(result.x).toBeLessThanOrEqual(100);
    expect(result.y).toBeGreaterThanOrEqual(0);
    expect(result.y).toBeLessThanOrEqual(100);
    expect(result.x).toBeCloseTo(29.4, 1);
    expect(result.y).toBeCloseTo(27.4, 1);
  });
});
