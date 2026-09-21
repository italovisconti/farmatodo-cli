import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import fs from "fs";
import path from "path";
import os from "os";
import {
  getCacheDir,
  readFromDiskCache,
  writeToDiskCache,
  getImageCacheStats,
  clearDiskCache,
  preloadNativeImage
} from "../src/image";

describe("Image Cache System", () => {
  const testUrl = "https://example.com/test-image-farmatodo.png";
  const dummyBuffer = Buffer.from("fake-png-data-for-farmatodo-testing");

  test("getCacheDir returns a valid path string", () => {
    const dir = getCacheDir();
    expect(typeof dir).toBe("string");
    expect(dir.length).toBeGreaterThan(0);
    expect(dir.includes("farmatodo-cli")).toBe(true);
  });

  test("writes and reads from persistent disk cache", () => {
    writeToDiskCache(testUrl, dummyBuffer);
    const read = readFromDiskCache(testUrl);
    expect(read).not.toBeNull();
    expect(read!.toString()).toBe("fake-png-data-for-farmatodo-testing");
  });

  test("getImageCacheStats reports cached files and size", () => {
    const stats = getImageCacheStats();
    expect(stats.count).toBeGreaterThanOrEqual(1);
    expect(stats.sizeBytes).toBeGreaterThan(0);
    expect(typeof stats.sizeFormatted).toBe("string");
  });

  test("clearDiskCache deletes cached files", () => {
    const deleted = clearDiskCache();
    expect(deleted).toBeGreaterThanOrEqual(1);

    const statsAfter = getImageCacheStats();
    expect(statsAfter.count).toBe(0);
    expect(statsAfter.sizeBytes).toBe(0);
  });
});
