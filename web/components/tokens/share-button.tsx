"use client";

import { useState } from "react";

export function ShareButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={async () => {
        const url = `${window.location.origin}${path}`;
        try {
          await navigator.clipboard.writeText(url);
        } catch {
          // clipboard API unavailable; no-op, button still gives visual feedback
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="rounded-full border border-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:border-neutral-600"
    >
      {copied ? "Copied!" : "Share"}
    </button>
  );
}
