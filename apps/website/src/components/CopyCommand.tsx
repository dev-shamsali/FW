"use client";

import { useState } from "react";

export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex max-w-full items-stretch overflow-hidden rounded-lg border border-white/15 bg-black/40 text-code-ink">
      <code className="overflow-x-auto px-4 py-2.5 text-sm whitespace-nowrap">
        <span aria-hidden="true" className="select-none opacity-50">
          ${" "}
        </span>
        {command}
      </code>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(command);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          } catch {
            /* clipboard unavailable: user can select the text */
          }
        }}
        className="border-l border-white/15 px-3 text-sm hover:bg-white/10"
      >
        {copied ? "Copied" : "Copy"}
        <span className="sr-only"> install command</span>
      </button>
    </div>
  );
}
