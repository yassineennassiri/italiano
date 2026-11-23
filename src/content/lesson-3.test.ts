/**
 * Issue #53: the A2.1.3 draft, *Il vicino di casa*, follows the lesson recipe
 * (SPEC §5.2) and is the lesson that teaches `register.lei`.
 */
import { describe, expect, it } from "vitest";
import { loadCourse, loadErrorTags, loadLesson } from "./load";

const lesson = loadLesson("a2.u01.l03");

describe("lesson a2.u01.l03", () => {
  it("is a draft listed in unit 1, after lesson 2", () => {
    expect(lesson).toMatchObject({ status: "draft", slug: "il-vicino-di-casa", title: "Il vicino di casa" });
    const unit = loadCourse().levels[0].units[0];
    expect(unit.lessons).toEqual(["a2.u01.l01", "a2.u01.l02", "a2.u01.l03"]);
  });

  it("has 8 to 11 steps, opens with a scene check whose first item is the gist question, and ends with Parla!", () => {
    const steps = lesson!.steps;
    expect(steps.length).toBeGreaterThanOrEqual(8);
    expect(steps.length).toBeLessThanOrEqual(11);
    expect(steps[0].media).toEqual({ kind: "scene" });
    expect(steps[0].items[0].prompt).toMatch(/^Prima di guardare: /);
    expect(steps.at(-1)!.items.map((item) => item.type)).toEqual(["parla"]);
  });

  it("has two grammar pages, 10 to 15 vocab entries and a culture page", () => {
    expect(lesson!.grammar).toHaveLength(2);
    expect(lesson!.vocab.length).toBeGreaterThanOrEqual(10);
    expect(lesson!.vocab.length).toBeLessThanOrEqual(15);
    expect(lesson!.culture?.md).toBeTruthy();
  });

  it("tags its register items with register.lei, which links to unit 1 and this lesson's grammar page", () => {
    const tagged = lesson!.steps.flatMap((step) => step.items).filter((item) => item.error_tags?.includes("register.lei"));
    expect(tagged.length).toBeGreaterThanOrEqual(4);

    const tag = loadErrorTags().find((entry) => entry.id === "register.lei");
    expect(tag).toMatchObject({ unit: "a2.u01", grammar_page: "a2.u01.l03.gr1", href: "/a2/il-vicino-di-casa/grammatica/1" });
    expect(lesson!.grammar[0].id).toBe("a2.u01.l03.gr1");
  });
});
