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
