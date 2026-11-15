import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "La strada di Adam",
  description: "Un corso di italiano personale, ambientato a Genova.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
