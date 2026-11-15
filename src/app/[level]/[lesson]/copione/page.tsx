import { ui } from "@/ui-it";
import { StubPage } from "../stub-page";

/** Script page (SPEC §4.8), filled in by #14. */
export default function ScriptPage({ params }: PageProps<"/[level]/[lesson]/copione">) {
  return <StubPage params={params} heading={ui.lesson.script} />;
}
