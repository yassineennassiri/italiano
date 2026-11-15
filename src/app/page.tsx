import Link from "next/link";
import { homeLevels, type LevelCard } from "@/content/overview";
import { ui } from "@/ui-it";

/** Home (SPEC §3.2): the three level cards and Continua da dove eri. */
export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-bold text-brand">{ui.home.heading}</h1>
      <p className="mt-2 max-w-2xl text-muted">{ui.home.intro}</p>

      {/* Placeholder until progress is stored: it will go to the last lesson and step. */}
      <button
        type="button"
        disabled
        className="mt-6 rounded-full bg-accent px-6 py-2 font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        {ui.home.continue}
      </button>

      <ul className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        {homeLevels().map((level) => (
          <li key={level.id} className="flex">
            <LevelCardView level={level} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function LevelCardView({ level }: { level: LevelCard }) {
  const body = (
    <>
      <span
        className={`flex size-16 items-center justify-center rounded-full text-xl font-bold ${
          level.available ? "bg-brand text-white" : "bg-line text-muted"
        }`}
        aria-hidden="true"
      >
        {ui.levelBadge(level.id)}
      </span>
      <span className="mt-4 flex items-center gap-2">
        <span className={`text-xl font-bold ${level.available ? "text-brand" : "text-muted"}`}>{level.title}</span>
        {!level.available && (
          <span className="rounded-full bg-line px-2 py-0.5 text-xs font-semibold text-muted">{ui.comingSoon}</span>
        )}
      </span>
      <span className="mt-2 text-sm text-muted">{level.description}</span>
    </>
  );
  const frame = "flex w-full flex-col items-start rounded-lg border p-6";

  if (!level.available) {
    return (
      <div aria-disabled="true" className={`${frame} border-line bg-white`}>
        {body}
      </div>
    );
  }
  return (
    <Link href={level.href} className={`${frame} border-brand/20 bg-tint transition hover:border-brand hover:shadow-md`}>
      {body}
    </Link>
  );
}
