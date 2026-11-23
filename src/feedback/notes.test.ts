import { describe, expect, it } from "vitest";
import { feedbackMarkdown, feedbackWriteSchema, groupOpenNotes, lessonNoteRef, type OpenNote } from "./notes";

describe("lessonNoteRef (SPEC §10.6)", () => {
  it("is the lesson id plus the page the learner is on", () => {
    expect(lessonNoteRef("a2.u01.l02", "/a2/la-casa-della-signora-pina", "/a2/la-casa-della-signora-pina/esercizi/4")).toBe(
      "a2.u01.l02/esercizi/4",
    );
    expect(lessonNoteRef("a2.u01.l01", "/a2/benvenuto-a-genova", "/a2/benvenuto-a-genova/vocabolario")).toBe("a2.u01.l01/vocabolario");
  });

  it("is the lesson id alone on the lesson's own URL, with or without a trailing slash", () => {
    expect(lessonNoteRef("a2.u01.l01", "/a2/benvenuto-a-genova", "/a2/benvenuto-a-genova")).toBe("a2.u01.l01");
    expect(lessonNoteRef("a2.u01.l01", "/a2/benvenuto-a-genova", "/a2/benvenuto-a-genova/info/")).toBe("a2.u01.l01/info");
  });
});

const note = (fields: Partial<OpenNote> & Pick<OpenNote, "id" | "scope" | "refId">): OpenNote => ({
  text: "testo",
  createdAt: new Date("2026-11-23T10:00:00.000Z"),
  ...fields,
});

const titles = { "a2": "Ripasso A2", "a2.u01.l01": "Benvenuto a Genova!", "a2.u01.l02": "La casa della signora Pina" } as Record<string, string>;
const titleOf = (id: string) => titles[id];

describe("groupOpenNotes", () => {
  it("groups lesson notes by lesson and level notes by level, in course order, oldest note first", () => {
    const groups = groupOpenNotes(
      [
        note({ id: "3", scope: "lesson", refId: "a2.u01.l02/esercizi/4", createdAt: new Date("2026-11-23T12:00:00Z") }),
        note({ id: "1", scope: "lesson", refId: "a2.u01.l01/info" }),
        note({ id: "2", scope: "lesson", refId: "a2.u01.l02", createdAt: new Date("2026-11-22T09:00:00Z") }),
        note({ id: "4", scope: "level", refId: "a2" }),
      ],
      titleOf,
    );
    expect(groups.map((group) => [group.id, group.title, group.notes.map((n) => n.id)])).toEqual([
      ["a2", "Ripasso A2", ["4"]],
      ["a2.u01.l01", "Benvenuto a Genova!", ["1"]],
      ["a2.u01.l02", "La casa della signora Pina", ["2", "3"]],
    ]);
  });

  it("keeps a note whose lesson no longer exists, titled by its id", () => {
    const [group] = groupOpenNotes([note({ id: "1", scope: "lesson", refId: "a2.u09.l09/copione" })], titleOf);
    expect(group).toMatchObject({ id: "a2.u09.l09", title: "a2.u09.l09" });
  });
});

describe("feedbackMarkdown", () => {
  it("prints the open notes grouped by lesson, each with its page and date", () => {
    const groups = groupOpenNotes(
      [
        note({ id: "1", scope: "lesson", refId: "a2.u01.l02/esercizi/4", text: "Il gap 2 accetta solo «un'»." }),
        note({ id: "2", scope: "level", refId: "a2", text: "Manca il test finale.", createdAt: new Date("2026-11-21T08:00:00Z") }),
      ],
      titleOf,
    );
    expect(feedbackMarkdown(groups)).toBe(
      [
        "# Feedback notes: 2 open",
        "",
        "## a2: Ripasso A2",
        "",
        "- `a2` (2026-11-21): Manca il test finale.",
        "",
        "## a2.u01.l02: La casa della signora Pina",
        "",
        "- `a2.u01.l02/esercizi/4` (2026-11-23): Il gap 2 accetta solo «un'».",
        "",
      ].join("\n"),
    );
  });

  it("indents the later lines of a note with several lines, so it stays one list item", () => {
    const groups = groupOpenNotes([note({ id: "1", scope: "lesson", refId: "a2.u01.l01/info", text: "Prima riga\n\nterza riga" })], titleOf);
    expect(feedbackMarkdown(groups)).toContain("- `a2.u01.l01/info` (2026-11-23): Prima riga\n\n  terza riga\n");
  });

  it("says when there are no open notes", () => {
    expect(feedbackMarkdown([])).toBe("# Feedback notes: none open\n");
  });
});

describe("feedbackWriteSchema", () => {
  const write = { eventId: "6f1c3c3e-6a54-4c39-9d4a-2f6f4f0e8a11", at: "2026-11-23T10:00:00.000Z", text: "  Un refuso.  " };

  it("takes a level note on a level id and a lesson note on a lesson page, trimming the text", () => {
    expect(feedbackWriteSchema.parse({ ...write, scope: "level", refId: "a2" }).text).toBe("Un refuso.");
    expect(feedbackWriteSchema.safeParse({ ...write, scope: "lesson", refId: "a2.u01.l02/esercizi/4" }).success).toBe(true);
    expect(feedbackWriteSchema.safeParse({ ...write, scope: "lesson", refId: "a2.u01.l02" }).success).toBe(true);
  });

  it("rejects a blank note, a ref that doesn't fit its scope, and the item scope nothing writes yet", () => {
    expect(feedbackWriteSchema.safeParse({ ...write, scope: "level", refId: "a2", text: "   " }).success).toBe(false);
    expect(feedbackWriteSchema.safeParse({ ...write, scope: "level", refId: "a2.u01.l02" }).success).toBe(false);
    expect(feedbackWriteSchema.safeParse({ ...write, scope: "lesson", refId: "a2" }).success).toBe(false);
    expect(feedbackWriteSchema.safeParse({ ...write, scope: "lesson", refId: "a2.u01.l02/../x" }).success).toBe(false);
    expect(feedbackWriteSchema.safeParse({ ...write, scope: "item", refId: "a2.u01.l02.s01.i01" }).success).toBe(false);
  });
});
