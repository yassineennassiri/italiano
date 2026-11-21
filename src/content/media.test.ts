import path from "node:path";
import { describe, expect, it } from "vitest";
import { mediaFile } from "./media";
import { mediaUrl } from "./media-url";
import { CONTENT_DIR } from "./test-content";

describe("mediaFile", () => {
  it("finds a file under content/media, with its type", () => {
    expect(mediaFile(["images", "a2", "u01", "l01", "poster.webp"])).toEqual({
      file: path.join(CONTENT_DIR, "media", "images", "a2", "u01", "l01", "poster.webp"),
      contentType: "image/webp",
    });
  });

  it("refuses paths that climb out of content/media", () => {
    expect(mediaFile(["..", "course.json"])).toBeUndefined();
    expect(mediaFile(["images", "..", "..", "course.json"])).toBeUndefined();
    expect(mediaFile(["images", "a2", "..\\..\\course.json"])).toBeUndefined();
  });

  it("refuses unknown file types and missing files", () => {
    expect(mediaFile(["images", "a2", "u01", "l01", "poster.exe"])).toBeUndefined();
    expect(mediaFile(["images", "a2", "u01", "l01", "missing.webp"])).toBeUndefined();
  });
});

describe("mediaUrl", () => {
  it("is where the app serves a content media path", () => {
    expect(mediaUrl("images/a2/u01/l01/poster.webp")).toBe("/media/images/a2/u01/l01/poster.webp");
  });
});
