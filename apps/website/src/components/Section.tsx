export function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-h`}
      className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-14 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-12 md:px-6 md:py-20"
    >
      <h2 id={`${id}-h`} className="text-2xl font-semibold tracking-tight md:sticky md:top-20 md:self-start">
        {title}
      </h2>
      <div className="min-w-0 max-w-3xl space-y-5 [&_a]:underline [&_a]:decoration-gold [&_a]:decoration-2 [&_a]:underline-offset-4 [&_p]:text-[1.0625rem] [&_p]:leading-[1.7]">
        {children}
      </div>
    </section>
  );
}

export function Code({ children, label }: { children: string; label?: string }) {
  return (
    <pre tabIndex={0} aria-label={label} className="overflow-x-auto rounded-lg bg-code p-4 text-xs leading-relaxed text-code-ink">
      {children}
    </pre>
  );
}
