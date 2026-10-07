"use client";

import { useEffect, useRef, useState } from "react";
import fixtures from "../data/fixtures.json";

/** The real middleware order installed by createApp, then your route. */
const LAYERS = [
  "Request ID",
  "Request logger",
  "Security headers",
  "CORS",
  "Rate limit",
  "Timeout",
  "Body size limit",
  "Pollution guard",
  "Validation",
  "Your handler",
  "Error handler",
];

type Scenario = (typeof fixtures.scenarios)[number];

export function Pipeline() {
  const [id, setId] = useState("proto");
  const scenario = fixtures.scenarios.find((s) => s.id === id) as Scenario;
  // `reached` is how many layers the packet has visited. Starts at the final state so the page works without JS.
  const [reached, setReached] = useState(scenario.layer);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setReached(scenario.layer);
      return;
    }
    let n = 0;
    setReached(0);
    timer.current = setInterval(() => {
      n += 1;
      setReached(n);
      if (n >= scenario.layer && timer.current) clearInterval(timer.current);
    }, 110);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [scenario.layer, id]);

  const stopped = scenario.id !== "ok";
  const { status, body, acao } = scenario.response;
  const bodyText = JSON.stringify(body, null, 2);

  return (
    <div className="rounded-lg border border-line bg-panel">
      <div role="group" aria-label="Choose a request to send" className="flex flex-wrap gap-2 border-b border-line p-3">
        {fixtures.scenarios.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={s.id === id}
            onClick={() => setId(s.id)}
            className={`rounded-full border px-3 py-1 text-sm transition-colors ${s.id === id ? "border-ink bg-ink text-bg" : "border-line text-slate hover:border-slate hover:text-ink"}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="grid gap-0 md:grid-cols-[13rem_1fr]">
        <ol aria-label="Request pipeline, in order" className="border-b border-line p-3 md:border-r md:border-b-0">
          {LAYERS.map((name, i) => {
            const n = i + 1;
            const here = n === scenario.layer;
            const visited = n <= reached && n < scenario.layer;
            const arrived = n === scenario.layer && reached >= scenario.layer;
            const beyond = n > scenario.layer;
            const state = arrived ? (stopped ? "stopped" : "reached") : visited ? "passed" : "pending";
            return (
              <li key={name} className={`flex items-center gap-2 py-[3px] text-sm ${beyond ? "text-slate/50" : "text-ink"}`}>
                <span
                  aria-hidden="true"
                  className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full border ${
                    state === "stopped"
                      ? "border-block bg-block"
                      : state === "reached"
                        ? "border-pass bg-pass"
                        : state === "passed"
                          ? "border-pass bg-pass/60"
                          : "border-line bg-transparent"
                  }`}
                />
                <span className={here && arrived ? "font-semibold" : ""}>{name}</span>
                {here && arrived && <span className="sr-only">{stopped ? " (request stopped here)" : " (request reached your code)"}</span>}
              </li>
            );
          })}
        </ol>

        <div className="min-w-0 p-3">
          <p className="mb-1 text-sm text-slate">Request</p>
          <pre tabIndex={0} className="mb-3 rounded bg-code p-3 text-xs leading-relaxed break-all whitespace-pre-wrap text-code-ink">
            {scenario.request}
          </pre>
          <div aria-live="polite">
            <p className="mb-1 text-sm text-slate">
              Response from the real server,{" "}
              <span className={status >= 400 || scenario.id === "cors" ? "font-semibold text-block" : "font-semibold text-pass"}>{status}</span>
            </p>
            <pre tabIndex={0} className="max-h-72 overflow-auto rounded bg-code p-3 text-xs leading-relaxed break-all whitespace-pre-wrap text-code-ink">
              {scenario.id === "cors" ? `Access-Control-Allow-Origin: ${acao ?? "(not sent)"}\n\n` : ""}
              {bodyText}
            </pre>
            <p className="mt-3 text-sm text-slate">{scenario.note}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
