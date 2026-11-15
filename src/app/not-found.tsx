import Link from "next/link";
import { ui } from "@/ui-it";

/** Any URL with no page: a lesson, step or grammar page the content doesn't have. */
export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-3xl font-bold text-brand">{ui.notFound.heading}</h1>
      <p className="mt-4 text-muted">{ui.notFound.text}</p>
      <Link href="/" className="mt-8 inline-block rounded-full bg-accent px-8 py-2 font-bold text-foreground hover:brightness-95">
        {ui.notFound.home}
      </Link>
    </div>
  );
}
