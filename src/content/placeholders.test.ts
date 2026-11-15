import { cpSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";
import { checkContent } from "./check";
import { generatePlaceholders } from "./placeholders";

const copies: string[] = [];

/** A copy of the real content with no media at all. */
function contentWithoutMedia(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "italiano-placeholders-"));
  cpSync(path.join(process.cwd(), "content"), dir, { recursive: true });
  rmSync(path.join(dir, "media"), { recursive: true, force: true });
  copies.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of copies.splice(0)) rmSync(dir, { recursive: true, force: true });
});

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
});
