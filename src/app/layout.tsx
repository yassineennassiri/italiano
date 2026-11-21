import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { TopBar } from "@/components/top-bar";
import { appBranch } from "@/db/env";
import { ui } from "@/ui-it";
import "./globals.css";

export const metadata: Metadata = {
  title: ui.appName,
  description: ui.appDescription,
};

/** Every page: the top bar, the page, the footer. `data-db-branch` lets the Playwright test refuse to run against `main`. */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" className="h-full antialiased" data-db-branch={appBranch()}>
      <body className="flex min-h-full flex-col">
        <TopBar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
