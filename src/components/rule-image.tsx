import { isBold, layoutRule, type PlacedArrow, type RuleBlock } from "@/content/rule-layout";
import { ui } from "@/ui-it";

/** The size of an arrowhead, in the rule's px. */
const HEAD = 9;

/**
 * A grammar rule image (SPEC §4.5): rows of styled words joined by arrows,
 * drawn as SVG from `layoutRule`. Screen readers hear the rows in order.
 */
export function RuleImage({ rule }: { rule: RuleBlock }) {
  const layout = layoutRule(rule);
  const rows = rule.rows.map((row) => row.map((segment) => segment.text).join("").trim());
  return (
    <svg
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      width={layout.width}
      className="h-auto max-w-full"
      role="img"
      aria-label={ui.lesson.ruleImage(rows)}
      fontSize={layout.fontSize}
    >
      {layout.segments.map((segment, index) => {
        return (
          <g key={index}>
            {segment.style === "highlight" && (
              <rect
                x={segment.x - 5}
                y={segment.y - layout.fontSize * 0.85}
                width={segment.width + 10}
                height={layout.fontSize * 1.2}
                rx={6}
                className="fill-accent/60"
              />
            )}
            <text
              x={segment.x}
              y={segment.y}
              textLength={segment.width}
              lengthAdjust="spacingAndGlyphs"
              className={segment.style === "highlight" ? "fill-brand" : "fill-foreground"}
              fontWeight={isBold(segment.style) ? "bold" : undefined}
              fontStyle={segment.style === "italic" ? "italic" : undefined}
            >
              {segment.text}
            </text>
          </g>
        );
      })}
      {layout.arrows.map((arrow, index) => (
        <Arrow key={index} arrow={arrow} />
      ))}
    </svg>
  );
}

function Arrow({ arrow: { x1, y1, x2, y2 } }: { arrow: PlacedArrow }) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const corner = (turn: number) =>
    `${x2 - HEAD * Math.cos(angle + turn)},${y2 - HEAD * Math.sin(angle + turn)}`;
  return (
    <g className="fill-brand stroke-brand">
      <line x1={x1} y1={y1} x2={x2 - (HEAD / 2) * Math.cos(angle)} y2={y2 - (HEAD / 2) * Math.sin(angle)} strokeWidth={2.5} strokeLinecap="round" />
      <polygon points={`${x2},${y2} ${corner(0.5)} ${corner(-0.5)}`} strokeWidth={1} strokeLinejoin="round" />
    </g>
  );
}
