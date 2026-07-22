import { useEffect, useRef, useState } from 'react';

export function NumericEditor({ value, min, max, step, label, className, autoFocus = false, onCommit, onFinish }: { value: number; min?: number; max?: number; step?: number; label: string; className?: string; autoFocus?: boolean; onCommit: (value: number) => void; onFinish?: () => void }) {
  const [draft, setDraft] = useState(String(value));
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { setDraft(String(value)); }, [value]);
  useEffect(() => { if (autoFocus) ref.current?.select(); }, [autoFocus]);
  const commit = () => {
    const parsed = Number(draft);
    if (draft.trim() === '' || draft === '-' || draft === '.' || draft === '-.' || !Number.isFinite(parsed)) { setDraft(String(value)); return; }
    onCommit(parsed); setDraft(String(parsed));
  };
  return <input ref={ref} className={className} aria-label={`${label}数值`} type="text" inputMode="decimal" value={draft} onFocus={event => event.currentTarget.select()} onChange={event => { const next = event.target.value; if (/^-?(?:\d+)?(?:\.\d*)?$/.test(next)) setDraft(next); }} onBlur={() => { commit(); onFinish?.(); }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { setDraft(String(value)); event.currentTarget.blur(); } }} />;
}

export function InlineNumber({ value, min, max, step, suffix = '', label, onChange }: { value: number; min?: number; max?: number; step?: number; suffix?: string; label: string; onChange: (value: number) => void }) {
  const [editing, setEditing] = useState(false);
  if (!editing) return <button type="button" className="inline-number" aria-label={`编辑${label}`} onClick={() => setEditing(true)}>{value}{suffix && ` ${suffix}`}</button>;
  return <span className="inline-number-editor"><NumericEditor autoFocus value={value} min={min} max={max} step={step} label={label} onCommit={onChange} onFinish={() => setEditing(false)} />{suffix && <small>{suffix}</small>}</span>;
}
