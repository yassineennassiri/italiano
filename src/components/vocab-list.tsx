import Image from "next/image";
import { mediaUrl } from "@/content/media-url";
import type { VocabEntry } from "@/content/schema";
import { ui } from "@/ui-it";
import { SpeakButton } from "./speak-button";

const GENDER_DOT: Record<NonNullable<VocabEntry["gender"]>, string> = { m: "bg-brand-light", f: "bg-feminine" };

/**
 * The vocabulary page's striped list (SPEC §4.6), in the order given: 🔊 and
 * the Italian term (a noun with its plural and gender dot) over the forms line,
 * an optional thumbnail, then the English meaning.
 */
export function VocabList({ entries }: { entries: readonly VocabEntry[] }) {
  return (
    <ul className="divide-y divide-line border-y border-line">
      {entries.map((entry) => (
        <li key={entry.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-2 py-3 odd:bg-tint sm:grid-cols-[1fr_4rem_1fr]">
          <div className="flex items-start gap-2">
            <SpeakButton id={`vocab:${entry.id}`} clip={{ text: entry.it, audio: entry.audio }} />
            <div className="min-w-0 pt-1.5">
              <p className="font-semibold text-brand">
                {entry.pos === "noun" && entry.plural ? ui.lesson.nounWithPlural(entry.it, entry.plural) : entry.it}
                {entry.gender && <GenderDot gender={entry.gender} />}
              </p>
              {entry.forms && <p className="text-sm text-muted">{entry.forms}</p>}
            </div>
          </div>
          <div className="row-span-2 sm:row-span-1">
            {entry.image && (
              <Image src={mediaUrl(entry.image)} alt={entry.it} width={64} height={64} className="size-16 rounded object-cover" />
            )}
          </div>
          <p lang="en" className="pl-11 sm:pl-0">
            {entry.en}
          </p>
        </li>
      ))}
    </ul>
  );
}

function GenderDot({ gender }: { gender: NonNullable<VocabEntry["gender"]> }) {
  return (
    <span
      title={ui.lesson.gender[gender]}
      className={`ml-2 inline-flex size-4 items-center justify-center rounded-full align-middle text-[0.625rem] leading-none font-bold text-white ${GENDER_DOT[gender]}`}
    >
      <span aria-hidden="true">{ui.lesson.genderLetter[gender]}</span>
      <span className="sr-only">{ui.lesson.genderLabel(gender)}</span>
    </span>
  );
}
