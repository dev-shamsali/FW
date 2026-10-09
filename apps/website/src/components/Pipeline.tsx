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
  const bad = status >= 400 || scenario.id === "cors";

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-panel shadow-[0_1px_0_var(--line),0_24px_60px_-30px_rgba(13,27,42,0.35)]">
      <div role="group" aria-label="Choose a request to send" className="flex gap-2 overflow-x-auto border-b border-line p-3 md:flex-wrap">
        {fixtures.scenarios.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={s.id === id}
            onClick={() => setId(s.id)}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition-colors ${s.id === id ? "border-ink bg-ink text-bg" : "border-line text-slate hover:border-slate hover:text-ink"}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <ol aria-label="Request pipeline, in order" className="grid gap-0 border-b border-line px-5 py-5 md:grid-cols-11 md:px-3 md:pt-7 md:pb-5">
        {LAYERS.map((name, i) => {
          const n = i + 1;
          const here = n === scenario.layer;
          const visited = n <= reached && n < scenario.layer;
          const arrived = n === scenario.layer && reached >= scenario.layer;
          const beyond = n > scenario.layer;
          const state = arrived ? (stopped ? "stopped" : "reached") : visited ? "passed" : "pending";
          return (
            <li
              key={name}
              className={`relative flex items-center gap-3 py-1.5 md:flex-col md:items-start md:gap-2 md:px-1.5 md:py-0 ${beyond ? "text-slate/50" : "text-ink"}`}
            >
              {i < LAYERS.length - 1 && (
                <span
                  aria-hidden="true"
                  className={`absolute top-5 left-[6px] h-full w-0.5 md:top-[7px] md:left-4 md:h-0.5 md:w-full ${visited ? "bg-pass" : "bg-line"}`}
                />
              )}
              <span
                aria-hidden="true"
                className={`relative z-10 h-3.5 w-3.5 shrink-0 rounded-full border-2 ${
                  state === "stopped"
                    ? "border-block bg-block ring-4 ring-block/20"
                    : state === "reached"
                      ? "border-pass bg-pass ring-4 ring-pass/20"
                      : state === "passed"
                        ? "border-pass bg-pass"
                        : "border-line bg-panel"
                }`}
              />
              <span className={`text-sm leading-tight md:text-[11px] ${here && arrived ? "font-bold" : ""}`}>{name}</span>
              {here && arrived && <span className="sr-only">{stopped ? " (request stopped here)" : " (request reached your code)"}</span>}
            </li>
          );
        })}
      </ol>

      <div className="grid md:grid-cols-2">
        <div className="min-w-0 border-b border-line p-4 md:border-r md:border-b-0">
          <p className="mb-2 text-sm text-slate">Request</p>
          <pre tabIndex={0} className="mb-3 rounded-lg bg-code p-3 text-xs leading-relaxed break-all whitespace-pre-wrap text-code-ink">
            {scenario.request}
          </pre>
          <p className="text-sm leading-relaxed text-slate">{scenario.note}</p>
        </div>
        <div className="min-w-0 p-4" aria-live="polite">
          <p className="mb-2 text-sm text-slate">
            Response from the real server{" "}
            <span className={`ml-1 rounded px-1.5 py-0.5 font-mono text-xs font-bold ${bad ? "bg-block/15 text-block" : "bg-pass/15 text-pass"}`}>
              {status}
            </span>
          </p>
          <pre tabIndex={0} className="max-h-72 overflow-auto rounded-lg bg-code p-3 text-xs leading-relaxed break-all whitespace-pre-wrap text-code-ink">
            {scenario.id === "cors" ? `Access-Control-Allow-Origin: ${acao ?? "(not sent)"}\n\n` : ""}
            {bodyText}
          </pre>
        </div>
      </div>
    </div>
  );
}
