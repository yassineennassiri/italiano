import { describe, expect, it } from "vitest";
import { checkContent } from "./check";
import { CONTENT_DIR, copyContent, editJson, LESSON_FILE } from "./test-content";

describe("checkContent", () => {
  it("finds no problems in the real content", () => {
    expect(checkContent(CONTENT_DIR)).toEqual([]);
  });

  it("reports a gap marker that has no gap entry", () => {
    const dir = copyContent();
    editJson(dir, LESSON_FILE, (lesson) => {
      // steps[1] is the dropdown "{{g1}} valigia, … {{g4}} computer."
      lesson.steps[1].items[0].gaps.pop();
    });
    expect(checkContent(dir)).toEqual([
      `${LESSON_FILE}: steps[1].items[0].text: gap marker {{g4}} has no gap entry`,
    ]);
  });

  it("reports an image_choice item without its image", () => {
    const dir = copyContent();
    const lesson2 = "levels/a2/units/01-arrivo-a-genova/lessons/02-la-casa-della-signora-pina.json";
    editJson(dir, lesson2, (lesson) => {
      // steps[7] is "Che cos'è?", three image_choice items.
      delete lesson.steps[7].items[0].image;
    });
    expect(checkContent(dir)).toEqual([`${lesson2}: steps[7].items[0].image: an image_choice item needs an image`]);
  });

  it("reports a choice answer index outside the options", () => {
    const dir = copyContent();
    editJson(dir, LESSON_FILE, (lesson) => {
      lesson.steps[0].items[0].answer = 3; // three options: 0..2
    });
    expect(checkContent(dir)).toEqual([
      `${LESSON_FILE}: steps[0].items[0].answer: answer index 3 is out of range (3 options)`,
    ]);
  });

  it("reports multi_select answer indexes outside the options", () => {
    const dir = copyContent();
    editJson(dir, LESSON_FILE, (lesson) => {
      lesson.steps[0].items[2].answers = [0, 4]; // four options: 0..3
    });
    expect(checkContent(dir)).toEqual([
      `${LESSON_FILE}: steps[0].items[2].answers[1]: answer index 4 is out of range (4 options)`,
    ]);
  });

  it("reports a dropdown answer that is not one of its options", () => {
    const dir = copyContent();
    editJson(dir, LESSON_FILE, (lesson) => {
      lesson.steps[1].items[0].gaps[0].answer = "le";
    });
    expect(checkContent(dir)).toEqual([
      `${LESSON_FILE}: steps[1].items[0].gaps[0].answer: answer "le" is not one of the options`,
    ]);
  });

  it("reports a word_bank whose bank can't fill every gap with its answer", () => {
    const dir = copyContent();
    const lesson2 = "levels/a2/units/01-arrivo-a-genova/lessons/02-la-casa-della-signora-pina.json";
    editJson(dir, lesson2, (lesson) => {
      // steps[8] is "Un messaggio a casa": the answers need un ×3, una ×2 and un' once.
      lesson.steps[8].items[0].bank = ["un", "uno", "una", "una", "un"];
    });
    expect(checkContent(dir)).toEqual([
      `${lesson2}: steps[8].items[0].bank: the answers need "un" 3 times but the bank holds it 2 times`,
      `${lesson2}: steps[8].items[0].bank: the answers need "un'" 1 time but the bank holds it 0 times`,
    ]);
  });

  it("reports a lesson whose last step has no parla item", () => {
    const dir = copyContent();
    editJson(dir, LESSON_FILE, (lesson) => {
      lesson.steps.pop();
    });
    expect(checkContent(dir)).toEqual([
      `${LESSON_FILE}: steps[4]: the last step must contain a parla item`,
    ]);
  });

  it("reports duplicate exchange ids inside a speaking item", () => {
    const dir = copyContent();
    editJson(dir, LESSON_FILE, (lesson) => {
      lesson.steps[4].items[0].exchanges[2].id = "e1";
    });
    expect(checkContent(dir)).toEqual([
      `${LESSON_FILE}: steps[4].items[0].exchanges[2].id: duplicate exchange id "e1"`,
    ]);
  });

  it("reports a rule arrow that points at a missing segment", () => {
    const dir = copyContent();
    editJson(dir, LESSON_FILE, (lesson) => {
      lesson.grammar[1].blocks[1].arrows[0].to = [2, 0]; // the rule has rows 0..1
    });
    expect(checkContent(dir)).toEqual([
      `${LESSON_FILE}: grammar[1].blocks[1].arrows[0].to: no segment [2, 0] in this rule`,
    ]);
  });

  it("accepts an audio_choice clip of scene lines that runs forward, or a single line", () => {
    const dir = copyContent();
    editJson(dir, LESSON_FILE, (lesson) => {
      lesson.steps[0].items[1].type = "audio_choice";
      lesson.steps[0].items[1].clip = { from_line: "L3", to_line: "L4" };
      lesson.steps[0].items[0].type = "audio_choice";
      lesson.steps[0].items[0].clip = { from_line: "L5", to_line: "L5" };
    });
    expect(checkContent(dir)).toEqual([]);
  });

  it("reports an audio_choice clip with an unknown line id", () => {
    const dir = copyContent();
    editJson(dir, LESSON_FILE, (lesson) => {
      lesson.steps[0].items[1].type = "audio_choice";
      lesson.steps[0].items[1].clip = { from_line: "L3", to_line: "L99" };
    });
    expect(checkContent(dir)).toEqual([`${LESSON_FILE}: steps[0].items[1].clip.to_line: no scene line "L99"`]);
  });

  it("reports clips that run backwards: audio_choice, audio_gap and clip step media", () => {
    const dir = copyContent();
    editJson(dir, LESSON_FILE, (lesson) => {
      lesson.steps[0].items[1].type = "audio_choice";
      lesson.steps[0].items[1].clip = { from_line: "L4", to_line: "L3" };
      lesson.steps[2].items[0].type = "audio_gap";
      lesson.steps[2].items[0].clip = { from_line: "L10", to_line: "L8" };
      delete lesson.steps[2].items[0].image;
      lesson.steps[3].media = { kind: "clip", from_line: "L2", to_line: "L1" };
    });
    expect(checkContent(dir)).toEqual([
      `${LESSON_FILE}: steps[0].items[1].clip: clip runs backwards: "L4" comes after "L3" in the scene`,
      `${LESSON_FILE}: steps[2].items[0].clip: clip runs backwards: "L10" comes after "L8" in the scene`,
      `${LESSON_FILE}: steps[3].media: clip runs backwards: "L2" comes after "L1" in the scene`,
    ]);
  });

  it("reports a scene panel that starts at an unknown line", () => {
    const dir = copyContent();
    editJson(dir, LESSON_FILE, (lesson) => {
      lesson.scene.panels[1].from_line = "L99";
    });
    expect(checkContent(dir)).toEqual([
      `${LESSON_FILE}: scene.panels[1].from_line: no scene line "L99"`,
    ]);
  });

  it("reports duplicate item and vocab ids", () => {
    const dir = copyContent();
    editJson(dir, LESSON_FILE, (lesson) => {
      lesson.steps[0].items[1].id = "a2.u01.l01.s01.i01";
      lesson.vocab.push({ ...lesson.vocab[0] });
    });
    expect(checkContent(dir)).toEqual([
      `${LESSON_FILE}: steps[0].items[1].id: duplicate item id "a2.u01.l01.s01.i01"`,
      `${LESSON_FILE}: vocab[10].id: duplicate vocab id "v-appartamento"`,
    ]);
  });

  it("reports ids that do not extend their parent's id", () => {
    const dir = copyContent();
    editJson(dir, LESSON_FILE, (lesson) => {
      lesson.steps[2].id = "a2.u01.l02.s03";
      lesson.steps[3].items[1].id = "a2.u01.l01.s03.i02";
    });
    expect(checkContent(dir)).toEqual([
      `${LESSON_FILE}: steps[2].id: "a2.u01.l02.s03" must look like "a2.u01.l01.sNN"`,
      `${LESSON_FILE}: steps[2].items[0].id: "a2.u01.l01.s03.i01" must look like "a2.u01.l02.s03.iNN"`,
      `${LESSON_FILE}: steps[3].items[1].id: "a2.u01.l01.s03.i02" must look like "a2.u01.l01.s04.iNN"`,
    ]);
  });

  it("reports a lesson listed in course.json that has no file", () => {
    const dir = copyContent();
    editJson(dir, "course.json", (course) => {
      course.levels[0].units[0].lessons.push("a2.u01.l03");
    });
    expect(checkContent(dir)).toEqual([
      `course.json: levels[0].units[0].lessons[2]: no lesson file for "a2.u01.l03"`,
    ]);
  });

  it("reports a lesson file that course.json does not list", () => {
    const dir = copyContent();
    editJson(dir, "course.json", (course) => {
      course.levels[0].units[0].lessons = ["a2.u01.l02"];
    });
    expect(checkContent(dir)).toEqual([
      `${LESSON_FILE}: lesson "a2.u01.l01" is not listed in course.json under unit "a2.u01"`,
    ]);
  });

  it("reports a lesson file whose name does not match its id and slug", () => {
    const dir = copyContent();
    editJson(dir, LESSON_FILE, (lesson) => {
      lesson.slug = "arrivo";
    });
    expect(checkContent(dir)).toEqual([
      `${LESSON_FILE}: lesson "a2.u01.l01" with slug "arrivo" must live at levels/a2/units/01-*/lessons/01-arrivo.json`,
    ]);
  });

  it("reports error tags that error-tags.json does not define", () => {
    const dir = copyContent();
    editJson(dir, LESSON_FILE, (lesson) => {
      lesson.steps[1].items[0].error_tags = ["article.elision", "article.elisione"];
      lesson.steps[1].items[0].notes[0].error_tag = "article.apostrophe";
    });
    expect(checkContent(dir)).toEqual([
      `${LESSON_FILE}: steps[1].items[0].error_tags[1]: unknown error tag "article.elisione"`,
      `${LESSON_FILE}: steps[1].items[0].notes[0].error_tag: unknown error tag "article.apostrophe"`,
    ]);
  });

  it("reports an error tag linked to a unit that course.json does not have", () => {
    const dir = copyContent();
    editJson(dir, "error-tags.json", (tags) => {
      tags["article.lo"].unit = "a2.u11";
    });
    expect(checkContent(dir)).toEqual([
      `error-tags.json: article.lo.unit: no unit "a2.u11" in course.json`,
    ]);
  });

  it("reports an error tag pointing at a grammar page its unit's lessons do not have", () => {
    const dir = copyContent();
    editJson(dir, "error-tags.json", (tags) => {
      tags["article.plural_gli"].grammar_page = "a2.u01.l01.gr9";
      tags["article.lo"].grammar_page = "a2.u02.l01.gr1";
    });
    expect(checkContent(dir)).toEqual([
      `error-tags.json: article.lo.grammar_page: "a2.u02.l01.gr1" is not in unit "a2.u01"`,
      `error-tags.json: article.plural_gli.grammar_page: no grammar page "a2.u01.l01.gr9" in lesson "a2.u01.l01"`,
    ]);
  });

  it("reports unit ids that don't match their level and number, or repeat", () => {
    const dir = copyContent();
    editJson(dir, "course.json", (course) => {
      course.levels[0].units[1].id = "b1.u02";
      course.levels[0].units[3].number = 3;
    });
    expect(checkContent(dir)).toEqual([
      `course.json: levels[0].units[1].id: "b1.u02" must be "a2.u02" (level a2, unit 2)`,
      `course.json: levels[0].units[3].id: "a2.u04" must be "a2.u03" (level a2, unit 3)`,
      `course.json: levels[0].units[3].number: duplicate unit number 3`,
    ]);
  });

  it("accepts vocab links to the lesson's own vocab in prompts, script lines, readings and gap text", () => {
    const dir = copyContent();
    editJson(dir, LESSON_FILE, (lesson) => {
      lesson.scene.lines[5].it = "Sì: la [[valigia|v-valigia]], lo [[zaino|v-zaino]] e l'[[ombrello|v-ombrello]].";
      lesson.steps[0].items[1].prompt = "Com'è andato il [[viaggio|v-viaggio]] di Adam?";
      lesson.steps[2].items[0].text = "il [[vicolo|v-vicolo]] → {{g1}} vicoli";
      lesson.steps[2].items[0].gaps = [{ id: "g1", answer: "i" }];
      lesson.steps[3].reading = "# I [[caruggi|v-caruggio]]";
      lesson.steps[3].script = [{ id: "x1", speaker: "pina", it: "Ecco l'[[appartamento|v-appartamento]].", en: "Here's the flat." }];
    });
    expect(checkContent(dir)).toEqual([]);
  });

  it("reports a vocab link to an entry that is not in the same lesson's vocab", () => {
    const dir = copyContent();
    editJson(dir, LESSON_FILE, (lesson) => {
      lesson.steps[0].items[0].prompt = "Chi aspetta Adam alla [[stazione|v-stazione]]?";
      // v-cucina is lesson 2's.
      lesson.scene.lines[7].it = "Allora andiamo: la [[cucina|v-cucina]] è vicina.";
    });
    expect(checkContent(dir)).toEqual([
      `${LESSON_FILE}: scene.lines[7].it: vocab link "v-cucina" is not in this lesson's vocab`,
      `${LESSON_FILE}: steps[0].items[0].prompt: vocab link "v-stazione" is not in this lesson's vocab`,
    ]);
  });

  it("reports a vocab link where it would give the answer away: options, tiles, bank and gap answers", () => {
    const dir = copyContent();
    const lesson2 = "levels/a2/units/01-arrivo-a-genova/lessons/02-la-casa-della-signora-pina.json";
    editJson(dir, LESSON_FILE, (lesson) => {
      lesson.steps[0].items[0].options[1] = "La [[valigia|v-valigia]]";
      lesson.steps[1].items[0].gaps[0].options[0] = "[[la|v-valigia]]";
      lesson.steps[2].items[0].gaps[1].answer = "[[gli|v-zaino]]";
      lesson.steps[3].items[0].tiles[3] = "il [[treno|v-viaggio]]";
    });
    editJson(dir, lesson2, (lesson) => {
      // steps[8] is "Un messaggio a casa", a word_bank.
      lesson.steps[8].items[0].bank.push("[[bagno|v-bagno]]");
      lesson.steps[8].items[0].gaps[0].accept = ["[[una|v-bagno]]"];
    });
    const answerAway = "a vocab link here would give the answer away";
    expect(checkContent(dir)).toEqual([
      `${LESSON_FILE}: steps[0].items[0].options[1]: ${answerAway}`,
      `${LESSON_FILE}: steps[1].items[0].gaps[0].options[0]: ${answerAway}`,
      `${LESSON_FILE}: steps[2].items[0].gaps[1].answer: ${answerAway}`,
      `${LESSON_FILE}: steps[3].items[0].tiles[3]: ${answerAway}`,
      `${lesson2}: steps[8].items[0].bank[7]: ${answerAway}`,
      `${lesson2}: steps[8].items[0].gaps[0].accept[0]: ${answerAway}`,
    ]);
  });

  it("reports a vocab link outside prompts, script lines, readings and gap text, where it would show as markup", () => {
    const dir = copyContent();
    editJson(dir, LESSON_FILE, (lesson) => {
      lesson.steps[0].title = "Il [[viaggio|v-viaggio]]";
      lesson.vocab[0].en = "[[flat|v-appartamento]]";
    });
    const elsewhere = "vocab links are allowed only in prompts, script lines, readings and gap text";
    expect(checkContent(dir)).toEqual([
      `${LESSON_FILE}: steps[0].title: ${elsewhere}`,
      `${LESSON_FILE}: vocab[0].en: ${elsewhere}`,
    ]);
  });

  it("reports a vocab link around a gap: links go outside the gaps", () => {
    const dir = copyContent();
    editJson(dir, LESSON_FILE, (lesson) => {
      lesson.steps[2].items[0].text = "il vicolo → [[{{g1}} vicoli|v-vicolo]]";
      lesson.steps[2].items[0].gaps = [{ id: "g1", answer: "i" }];
    });
    expect(checkContent(dir)).toEqual([
      `${LESSON_FILE}: steps[2].items[0].text: a vocab link must sit outside the gaps`,
    ]);
  });

  it("reports a malformed vocab link", () => {
    const dir = copyContent();
    editJson(dir, LESSON_FILE, (lesson) => {
      lesson.steps[0].items[1].prompt = "Com'è andato il [[viaggio]] di Adam?";
    });
    expect(checkContent(dir)).toEqual([
      `${LESSON_FILE}: steps[0].items[1].prompt: malformed vocab link: write [[word|v-id]]`,
    ]);
  });

  it("reports referenced media files that do not exist", () => {
    const dir = copyContent();
    editJson(dir, LESSON_FILE, (lesson) => {
      lesson.culture.image = "images/a2/u01/l01/missing.webp";
      lesson.scene.lines[0].audio = "audio/a2/u01/l01/missing.mp3";
    });
    expect(checkContent(dir)).toEqual([
      `${LESSON_FILE}: scene.lines[0].audio: media file "audio/a2/u01/l01/missing.mp3" does not exist under content/media`,
      `${LESSON_FILE}: culture.image: media file "images/a2/u01/l01/missing.webp" does not exist under content/media`,
    ]);
  });
});
