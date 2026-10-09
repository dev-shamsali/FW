import fixtures from "../data/fixtures.json";

/** Renders captured output from real CLI runs (see scripts/gen-fixtures.mjs). */
export function Terminal({ only }: { only?: string[] }) {
  const steps = fixtures.cli.filter((s) => !only || only.some((o) => s.cmd.includes(o)));
  return (
    <div
      role="region"
      aria-label="Captured CLI output"
      tabIndex={0}
      className="overflow-x-auto rounded-xl border border-white/10 bg-code p-4 text-xs leading-relaxed text-code-ink"
    >
      {steps.map((s) => (
        <div key={s.cmd} className="mb-4 last:mb-0">
          <div>
            <span aria-hidden="true" className="select-none opacity-50">
              ${" "}
            </span>
            {s.cmd}
          </div>
          <pre className="mt-1 whitespace-pre-wrap opacity-80">{s.output}</pre>
        </div>
      ))}
    </div>
  );
}

export const capturedWith = () => `Captured from real runs on Node ${fixtures.node} (${fixtures.platform}), @rheajs/core ${fixtures.versions.core}.`;
