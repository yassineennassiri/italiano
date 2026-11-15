import { ui } from "@/ui-it";
import { StubPage } from "../stub-page";

/** Finish screen (SPEC §4.9: its heading is also Risultati della lezione), filled in by #15. */
export default function FinishPage({ params }: PageProps<"/[level]/[lesson]/fine">) {
  return <StubPage params={params} heading={ui.lesson.results} />;
}
