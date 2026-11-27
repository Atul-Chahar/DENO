'use client';

import { useRef, useState } from 'react';
import { play } from '@/lib/sound';

/** Copies `text` to the clipboard and says so for two seconds. */
export function CopyButton({
  text,
  label = 'Copy',
  done = 'Copied',
  className = 'btn btn--sm btn--ghost',
  chime = false,
  onCopied,
}: {
  text: string;
  label?: string;
  done?: string;
  className?: string;
  /** Play the quiet "copied" sound (marketing pages; visitors can turn it off). */
  chime?: boolean;
  onCopied?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API blocked (old browser, http): fall back to a hidden textarea.
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    setCopied(true);
    if (chime) play('copy');
    onCopied?.();
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button type="button" className={className} onClick={copy} aria-live="polite">
      {copied ? done : label}
    </button>
  );
}
