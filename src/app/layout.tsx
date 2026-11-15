import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { TopBar } from "@/components/top-bar";
import { ui } from "@/ui-it";
import "./globals.css";

export const metadata: Metadata = {
  title: ui.appName,
  description: ui.appDescription,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <TopBar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
