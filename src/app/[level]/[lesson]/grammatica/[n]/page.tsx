import { ui } from "@/ui-it";
import { StubPage } from "../../stub-page";

/** Grammar page n (SPEC §4.5), filled in by #16. */
export default function GrammarPage({ params }: PageProps<"/[level]/[lesson]/grammatica/[n]">) {
  return <StubPage params={params} heading={ui.lesson.grammar} page="grammatica" />;
}
