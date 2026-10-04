'use client';

import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { X } from 'lucide-react';

let openDialogs = 0;
let previousBodyOverflow = '';

export function DetailDialog({ title, eyebrow, onClose, children, compact = false, variant = 'details', focusKey }: { title: string; eyebrow: string; onClose: () => void; children: ReactNode; compact?: boolean; variant?: 'details' | 'navigation'; focusKey?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const containFocus = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== 'Tab') return;
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, video[controls], [tabindex="0"]')].filter((item) => item.getClientRects().length && getComputedStyle(item).visibility !== 'hidden');
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  useEffect(() => {
    const dialog = ref.current!;
    const opener = document.activeElement as HTMLElement | null;
    dialog.showModal();
    if (openDialogs++ === 0) previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      if (--openDialogs === 0) document.body.style.overflow = previousBodyOverflow;
      if (opener?.isConnected) opener.focus();
      else [...document.querySelectorAll<HTMLElement>('dialog[open] [data-dialog-close], [data-focus-home], button[aria-label="Open navigation"]')].find((element) => element.getClientRects().length)?.focus();
    };
  }, []);
  useEffect(() => {
    if (!focusKey) return;
    ref.current?.querySelector<HTMLElement>('[data-dialog-close]')?.focus();
    ref.current?.querySelector('.dialog-content')?.scrollTo(0, 0);
  }, [focusKey]);
  return <dialog ref={ref} aria-labelledby={titleId} onKeyDown={containFocus} className={'detail-dialog' + (compact ? ' compact-dialog' : '') + (variant === 'navigation' ? ' navigation-dialog' : '')} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="dialog-inner">
      <header className="dialog-heading"><div><span className="eyebrow">{eyebrow}</span><h2 id={titleId}>{title}</h2></div><button className="icon-button" data-dialog-close autoFocus onClick={onClose} aria-label={variant === 'navigation' ? 'Close navigation' : 'Close details'}><X size={20} /></button></header>
      <div className="dialog-content">{children}</div>
    </div>
  </dialog>;
}
