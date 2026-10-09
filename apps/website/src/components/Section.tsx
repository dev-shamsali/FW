export function Section({
  id,
  title,
  lead,
  tone = "plain",
  children,
}: {
  id: string;
  title: string;
  lead?: string;
  tone?: "plain" | "inverse";
  children: React.ReactNode;
}) {
  const inverse = tone === "inverse";
  return (
    <section id={id} aria-labelledby={`${id}-h`} className={inverse ? "bg-code text-code-ink" : "border-t border-line"}>
      <div className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
        <div className="mb-10 max-w-3xl md:mb-14">
          <h2 id={`${id}-h`} className="text-[clamp(1.85rem,4.4vw,3rem)] leading-[1.08] font-bold tracking-tight text-balance">
            {title}
          </h2>
          {lead && <p className={`mt-4 text-lg leading-relaxed ${inverse ? "text-code-ink/75" : "text-slate"}`}>{lead}</p>}
        </div>
        <div
          className={`min-w-0 space-y-5 [&_a]:underline [&_a]:decoration-gold [&_a]:decoration-2 [&_a]:underline-offset-4 [&_p]:max-w-3xl [&_p]:text-[1.0625rem] [&_p]:leading-[1.7] ${inverse ? "[&_code]:text-gold" : ""}`}
        >
          {children}
        </div>
      </div>
    </section>
  );
}

export function Code({ children, label }: { children: string; label?: string }) {
  return (
    <figure className="overflow-hidden rounded-xl border border-white/10 bg-code">
      {label && <figcaption className="border-b border-white/10 px-4 py-2 text-xs text-code-ink/60">{label}</figcaption>}
      <pre tabIndex={0} aria-label={label} className="overflow-x-auto p-4 text-xs leading-relaxed text-code-ink">
        {children}
      </pre>
    </figure>
  );
}
