import { readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { checkContent } from "./check";
import { generatePlaceholders } from "./placeholders";
import { copyContent, LESSON_FILE } from "./test-content";

/** A copy of the real content with no media at all. */
function contentWithoutMedia(): string {
  const dir = copyContent();
  rmSync(path.join(dir, "media"), { recursive: true, force: true });
  return dir;
}

describe("generatePlaceholders", () => {
  it("creates an image for every referenced image path, so the content checks clean", async () => {
    const dir = contentWithoutMedia();

    const created = await generatePlaceholders(dir);

    expect(created).toContain("images/a2/u01/l01/poster.webp");
    expect(created).toContain("images/a2/u01/l01/caruggi.webp");
    expect(checkContent(dir)).toEqual([]);
  });

  it("writes real WebP images, 16:9 for posters and panels", async () => {
    const dir = contentWithoutMedia();
    await generatePlaceholders(dir);

    // Read into a buffer: sharp keeps file inputs open, which blocks cleanup on Windows.
    const metadata = (file: string) => sharp(readFileSync(path.join(dir, "media", file))).metadata();
    const poster = await metadata("images/a2/u01/l01/poster.webp");
    expect(poster.format).toBe("webp");
    expect(poster.width! / poster.height!).toBeCloseTo(16 / 9, 2);

    const item = await metadata("images/a2/u01/l01/caruggi.webp");
    expect(item.format).toBe("webp");
  });

  it("leaves existing media alone", async () => {
    const dir = contentWithoutMedia();
    await generatePlaceholders(dir);
    const poster = path.join(dir, "media/images/a2/u01/l01/poster.webp");
    writeFileSync(poster, "a real illustration");

    const created = await generatePlaceholders(dir);

    expect(created).toEqual([]);
    expect(statSync(poster).size).toBe("a real illustration".length);
  });

  it("skips a lesson file that isn't valid JSON instead of crashing", async () => {
    const dir = contentWithoutMedia();
    writeFileSync(path.join(dir, LESSON_FILE), "{ not json");
    await expect(generatePlaceholders(dir)).resolves.toEqual([]);
  });
});
