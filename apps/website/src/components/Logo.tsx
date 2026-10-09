/** The Rhea monogram, drawn as a mask so it follows the text colour in light and dark themes. */
export function Logo({ className = "h-7 w-[30px]" }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="Rhea.js logo"
      className={`inline-block shrink-0 bg-ink ${className}`}
      style={{
        WebkitMask: "url(/brand/rhea-mark.png) center / contain no-repeat",
        mask: "url(/brand/rhea-mark.png) center / contain no-repeat",
      }}
    />
  );
}

/** Large decorative rings behind the hero. */
export function Rings() {
  return (
    <svg viewBox="0 0 800 800" className="pointer-events-none absolute -top-24 -right-40 h-[44rem] w-[44rem] opacity-70 md:-right-24" aria-hidden="true">
      {[110, 200, 290, 380].map((r) => (
        <circle key={r} cx="400" cy="400" r={r} fill="none" stroke="var(--line)" strokeWidth="1.5" />
      ))}
      <path d="M400 20a380 380 0 0 1 380 380" fill="none" stroke="var(--gold)" strokeWidth="5" strokeLinecap="round" />
      <path d="M400 110a290 290 0 0 1 290 290" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}
