import Link from "next/link";

export function RouteNotFound({
  title,
  href,
  linkLabel,
}: {
  title: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <section className="border-y border-line py-12">
      <h1 className="text-2xl font-medium">{title}</h1>
      <Link
        href={href}
        className="mt-6 inline-flex min-h-11 items-center text-sm underline underline-offset-4 outline-none focus-visible:outline-2 focus-visible:outline-signal"
      >
        {linkLabel}
      </Link>
    </section>
  );
}
