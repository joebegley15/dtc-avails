"use client";

import { useState } from "react";

/** A small underlined button that copies `text` and says "Copied!" briefly. */
export function CopyButton({
  text,
  label,
  disabled = false,
}: {
  text: string;
  label: string;
  disabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can fail (permissions, non-secure context); the
      // link is still on screen to copy by hand, so this isn't fatal.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      disabled={disabled}
      className="text-sm text-zinc-500 underline hover:text-zinc-950 disabled:opacity-50"
    >
      {copied ? "Copied!" : label}
    </button>
  );
}
