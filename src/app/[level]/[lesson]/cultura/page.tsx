import { ui } from "@/ui-it";
import { StubPage } from "../stub-page";

/** Culture page (SPEC §4.7), filled in by #16. */
export default function CulturePage({ params }: PageProps<"/[level]/[lesson]/cultura">) {
  return <StubPage params={params} heading={ui.lesson.culture} page="cultura" />;
}
