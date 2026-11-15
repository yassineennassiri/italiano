import { ui } from "@/ui-it";
import { StubPage } from "../stub-page";

/** Results (SPEC §4.4), filled in by #15. */
export default function Page({ params }: PageProps<"/[level]/[lesson]/risultati">) {
  return <StubPage params={params} heading={ui.lesson.results} />;
}
