import { ui } from "@/ui-it";
import { StubPage } from "../stub-page";

/** Vocabulary page (SPEC §4.6), filled in by #16. */
export default function Page({ params }: PageProps<"/[level]/[lesson]/vocabolario">) {
  return <StubPage params={params} heading={ui.lesson.vocabulary} exists={(lesson) => lesson.vocab.length > 0} />;
}
