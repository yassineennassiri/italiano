import { ui } from "@/ui-it";
import { pageNumber } from "@/content/lesson-nav";
import { StubPage } from "../../stub-page";

/** Grammar page n (SPEC §4.5), filled in by #16. */
export default function Page({ params }: PageProps<"/[level]/[lesson]/grammatica/[n]">) {
  return <StubPage params={params} heading={ui.lesson.grammar} exists={(lesson, n) => pageNumber(n ?? "", lesson.grammar.length) !== undefined} />;
}
