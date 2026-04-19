export function SectionHeading({
  eyebrow,
  title,
  description
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-2">
      {eyebrow ? (
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-ocean/70">
          {eyebrow}
        </div>
      ) : null}
      <h2 className="font-display text-3xl text-ink sm:text-4xl">{title}</h2>
      {description ? (
        <p className="max-w-2xl text-sm leading-6 text-gray-600 sm:text-base">
          {description}
        </p>
      ) : null}
    </div>
  );
}
