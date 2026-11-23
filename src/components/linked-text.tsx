import { Fragment } from "react";
import { splitVocabLinks } from "@/content/vocab-links";
import { VocabLink } from "./vocab-link";

/**
 * Content text with its `[[word|v-id]]` vocab links rendered as links (SPEC
 * §4.3): prompts, script lines, readings and gap text. Plain runs stay plain
 * text, so this renders on the server and the client alike.
 */
export function LinkedText({ text }: { text: string }) {
  return splitVocabLinks(text).map((piece, index) =>
    "text" in piece ? (
      <Fragment key={index}>{piece.text}</Fragment>
    ) : (
      <VocabLink key={index} word={piece.word} vocabId={piece.vocabId} />
    ),
  );
}
