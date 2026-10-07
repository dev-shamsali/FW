"use client";

import { useEffect, useState } from "react";

type Theme = "system" | "light" | "dark";
const ORDER: Theme[] = ["system", "light", "dark"];

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("rhea-theme");
      if (saved === "light" || saved === "dark") setTheme(saved);
    } catch {
      /* storage unavailable: stay on system */
    }
  }, []);

  function next() {
    const t = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length]!;
    setTheme(t);
    try {
      if (t === "system") localStorage.removeItem("rhea-theme");
      else localStorage.setItem("rhea-theme", t);
    } catch {
      /* ignore */
    }
    if (t === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
  }

  return (
    <button
      type="button"
      onClick={next}
      aria-label={`Theme: ${theme}. Click to change.`}
      className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-panel text-ink"
    >
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-[1.1rem] w-[1.1rem]" aria-hidden="true">
        {theme === "dark" ? (
          <path d="M16 11.5A6.5 6.5 0 0 1 8.5 4a6.5 6.5 0 1 0 7.5 7.5Z" strokeLinejoin="round" />
        ) : theme === "light" ? (
          <>
            <circle cx="10" cy="10" r="3.6" />
            <path d="M10 1.8v2M10 16.2v2M1.8 10h2M16.2 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4" strokeLinecap="round" />
          </>
        ) : (
          <>
            <circle cx="10" cy="10" r="7" />
            <path d="M10 3v14" />
            <path d="M10 3a7 7 0 0 1 0 14Z" fill="currentColor" />
          </>
        )}
      </svg>
    </button>
  );
}
