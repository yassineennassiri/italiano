/**
 * The geometry of a grammar `rule` block (SPEC §4.5, §9.1): rows of styled
 * segments, joined by arrows, drawn as SVG. Pure, so it is tested without a
 * browser and renders on the server. Text widths are estimates; the SVG pins
 * each segment to its estimated width (`textLength`), so the arrows always
 * meet the words. M1 draws only `down` arrows.
 */
import type { GrammarBlock, RuleSegment } from "./schema";

export type RuleBlock = Extract<GrammarBlock, { kind: "rule" }>;
export type RuleStyle = NonNullable<RuleSegment["style"]>;

/** A segment's text, placed: `x` is its left edge, `y` its baseline. */
export type PlacedSegment = { row: number; text: string; style: RuleStyle; x: number; y: number; width: number };

/** An arrow from (x1, y1) to its head at (x2, y2). */
export type PlacedArrow = { x1: number; y1: number; x2: number; y2: number };

export type RuleLayout = { width: number; height: number; fontSize: number; segments: PlacedSegment[]; arrows: PlacedArrow[] };

const FONT_SIZE = 24;
/** Room for a highlight's padding at the edges. */
const PAD = 8;
/** Above the baseline to the top of the letters, and below it to the bottom of the descenders. */
const ASCENT = FONT_SIZE * 0.8;
const DESCENT = FONT_SIZE * 0.3;
/** Between two rows: room for an arrow, or just a little air. */
const ARROW_GAP = FONT_SIZE * 1.8;
const ROW_GAP = FONT_SIZE * 0.5;
/** Between a word and an arrow's ends. */
const ARROW_CLEARANCE = 4;

/** Rough advance widths in em of a sans-serif face; anything else is a lowercase-width letter. */
const NARROW = new Set("iljtfr'’.,;:!|()[] ");
const WIDE = new Set("mwMW");

function charWidth(char: string): number {
  if (NARROW.has(char)) return 0.3;
  if (WIDE.has(char)) return 0.85;
  if (char !== char.toLowerCase()) return 0.68;
  return 0.56;
}

/** The estimated width of `text` in px at the rule's font size; bold runs wider. */
function textWidth(text: string, style: RuleStyle): number {
  const em = [...text].reduce((sum, char) => sum + charWidth(char), 0);
  return em * FONT_SIZE * (style === "bold" || style === "highlight" ? 1.08 : 1);
}

/** Lays out a rule: its segments row by row, then its down arrows between them. */
export function layoutRule(rule: RuleBlock): RuleLayout {
  const downArrows = (rule.arrows ?? []).filter((arrow) => arrow.kind === "down");
  /** Whether an arrow crosses the gap under row `row`. */
  const arrowUnder = (row: number) =>
    downArrows.some(({ from: [a], to: [b] }) => Math.min(a, b) <= row && row < Math.max(a, b));

  const segments: PlacedSegment[] = [];
  const placed: PlacedSegment[][] = [];
  let baseline = PAD + ASCENT;
  rule.rows.forEach((row, r) => {
    if (r > 0) baseline += DESCENT + (arrowUnder(r - 1) ? ARROW_GAP : ROW_GAP) + ASCENT;
    let x = PAD;
    placed.push(
      row.map((segment) => {
        const style = segment.style ?? "plain";
        const leading = segment.text.length - segment.text.trimStart().length;
        const text = segment.text.trim();
        x += textWidth(" ".repeat(leading), "plain");
        const width = textWidth(text, style);
        const box = { row: r, text, style, x, y: baseline, width };
        x += width + textWidth(" ".repeat(segment.text.length - leading - text.length), "plain");
        segments.push(box);
        return box;
      }),
    );
  });

  const arrows = downArrows.map(({ from, to }) => {
    const start = placed[from[0]][from[1]];
    const end = placed[to[0]][to[1]];
    const downward = end.y >= start.y;
    // Straight down when the two words overlap: halfway between their centres, if that is over both.
    const startCentre = start.x + start.width / 2;
    const endCentre = end.x + end.width / 2;
    const middle = (startCentre + endCentre) / 2;
    const straight = [start, end].every((box) => box.x < middle && middle < box.x + box.width);
    return {
      x1: straight ? middle : startCentre,
      y1: downward ? start.y + DESCENT + ARROW_CLEARANCE : start.y - ASCENT - ARROW_CLEARANCE,
      x2: straight ? middle : endCentre,
      y2: downward ? end.y - ASCENT - ARROW_CLEARANCE : end.y + DESCENT + ARROW_CLEARANCE,
    };
  });

  const width = Math.max(...segments.map((segment) => segment.x + segment.width)) + PAD;
  return { width, height: baseline + DESCENT + PAD, fontSize: FONT_SIZE, segments, arrows };
}
