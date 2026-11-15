import { ui } from "@/ui-it";
import { StubPage } from "../stub-page";

/** Finish screen (SPEC §4.9), filled in by #15. */
export default function Page({ params }: PageProps<"/[level]/[lesson]/fine">) {
  return <StubPage params={params} heading={ui.lesson.results} />;
}
