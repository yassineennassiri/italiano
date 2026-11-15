# Language rule: teach in English, everything else in Italian

DW's *Nicos Weg* keeps all chrome and instructions in English. The learner is B1 and wants maximum Italian exposure, but must never misread a grammar rule. So: **teaching text and translations are in English; everything else is in Italian**, from the first lesson.

- **Italian:** all chrome (buttons, menus, headers, footer, results lines), step titles and instructions, the intro page, speaking hints and the Parla! task and checklist, note labels, and of course prompts, dialogues, options and vocab terms.
- **English:** grammar page prose and term definitions, note text, error-tag explanations, vocab meanings, script translations, the culture page.
- An optional `instruction_en` per step, shown behind an **EN** toggle, is the escape hatch for a tricky instruction. It replaces the spec's original "Instructions in Italian" setting.

Content field names follow the rule: no suffix means Italian, `_en` means English. One exception by convention: the `md` fields of grammar `text` blocks and of the culture page are English with no suffix, because those pages are teaching text throughout. All UI strings live in one module (`ui-it.ts`).

## Considered Options

- **Italian chrome only, English titles and instructions** (closest to DW): rejected as too little exposure for a B1 learner.
- **Everything in Italian, grammar included**: rejected because a misread rule teaches the wrong thing.
