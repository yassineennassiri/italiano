import Link from "next/link";
import { homeLevels } from "@/content/overview";
import { ui } from "@/ui-it";
import { LanternaLogo } from "./lanterna-logo";
import { MainMenu } from "./main-menu";

/** The sticky top bar (SPEC §3.1): logo and wordmark, app title, hamburger. */
export function TopBar() {
  const levels = homeLevels().map(({ id, title, href, available }) => ({ id, title, href, available }));
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-white">
      <div className="mx-auto grid h-16 max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-4">
        <Link href="/" aria-label={ui.topBar.homeLink} className="flex items-center gap-2 justify-self-start rounded">
          <LanternaLogo className="h-10 w-8" />
          <span className="hidden text-lg font-bold lowercase tracking-tight text-brand sm:inline">{ui.wordmark}</span>
        </Link>
        <p className="text-center text-lg font-bold text-brand sm:text-2xl">{ui.appName}</p>
        <div className="justify-self-end">
          <MainMenu levels={levels} />
        </div>
      </div>
    </header>
  );
}
