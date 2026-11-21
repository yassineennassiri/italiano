import { describe, expect, it } from "vitest";
import { insertAt, ITALIAN_CHARACTERS } from "./typing";

describe("insertAt", () => {
  it("inserts at the cursor and puts the cursor after the inserted character", () => {
    expect(insertAt("perche", 6, 6, "é")).toEqual({ value: "percheé", cursor: 7 });
    expect(insertAt("cafe", 3, 3, "è")).toEqual({ value: "cafèe", cursor: 4 });
  });

  it("replaces the selected text", () => {
    expect(insertAt("perche", 5, 6, "é")).toEqual({ value: "perché", cursor: 6 });
  });

  it("appends when the input has no cursor yet", () => {
    expect(insertAt("citt", null, null, "à")).toEqual({ value: "città", cursor: 5 });
  });
});

describe("ITALIAN_CHARACTERS", () => {
  it("is the palette from SPEC §5.1", () => {
    expect(ITALIAN_CHARACTERS).toEqual(["à", "è", "é", "ì", "ò", "ù", "À", "È"]);
  });
});
