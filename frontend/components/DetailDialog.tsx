'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';

export function DetailDialog({ title, eyebrow, onClose, children, compact = false }: { title: string; eyebrow: string; onClose: () => void; children: ReactNode; compact?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current!;
    const opener = document.activeElement as HTMLElement | null;
    dialog.showModal();
    return () => {
      dialog.close();
      if (opener?.isConnected) opener.focus();
      else (document.querySelector<HTMLElement>('dialog[open] [autofocus]') ?? document.querySelector<HTMLElement>('[data-focus-home]'))?.focus();
    };
  }, []);
  return <dialog ref={ref} aria-labelledby={titleId} className={'detail-dialog' + (compact ? ' compact-dialog' : '')} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="dialog-inner">
      <header className="dialog-heading"><div><span className="eyebrow">{eyebrow}</span><h2 id={titleId}>{title}</h2></div><button className="icon-button" autoFocus onClick={onClose} aria-label="Close details">×</button></header>
      <div className="dialog-content">{children}</div>
    </div>
  </dialog>;
}
