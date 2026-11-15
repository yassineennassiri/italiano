import { AccentLink } from "@/components/accent-link";
import { ui } from "@/ui-it";

/** Any URL with no page: a lesson, step or grammar page the content doesn't have. */
export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-3xl font-bold text-brand">{ui.notFound.heading}</h1>
      <p className="mt-4 text-muted">{ui.notFound.text}</p>
      <AccentLink href="/" className="mt-8">
        {ui.notFound.home}
      </AccentLink>
    </div>
  );
}
