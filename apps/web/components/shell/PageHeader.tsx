export function PageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <header className="max-w-3xl border-b border-line pb-8">
      <h1 className="text-[30px] leading-9 font-medium tracking-tight">
        {title}
      </h1>
      <p className="mt-3 text-[15px] leading-5.5 text-ink-secondary">
        {description}
      </p>
    </header>
  );
}
