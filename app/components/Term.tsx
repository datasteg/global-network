'use client';
// <Term id="hhi">label</Term>: a technical term with a dotted underline and a small ⓘ. Click or tap opens its glossary
// card (what it is, how to read it, how it is calculated, sources); on a desktop pointer, hovering previews it. Esc, the
// close button or a click outside closes it, and focus returns to the term. On a phone the card is a bottom sheet.
// The card renders right after the term in the DOM, so Tab reaches its links in reading order.
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { CiteList } from './Cite';
import { useSiteInfo } from './SiteInfo';

const W = {
  en: { what: 'What it is', read: 'How to read it', calc: 'How it is calculated', why: 'Why it matters', thr: 'Threshold', ex: 'Example', src: 'Source', close: 'Close', more: 'Explain' },
  ko: { what: '무엇인가', read: '읽는 법', calc: '계산', why: '중요성', thr: '기준치', ex: '예', src: '출처', close: '닫기', more: '설명' },
};
const PARTS = ['what', 'why', 'read', 'calc', 'thr', 'ex'] as const;

/** While a range slider is dragged no card opens, and an open one closes, so a card never covers the slider. */
let dragging = false;
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', (e) => { if ((e.target as HTMLElement)?.matches?.('input[type=range]')) dragging = true; }, true);
  window.addEventListener('pointerup', () => { dragging = false; }, true);
  window.addEventListener('pointercancel', () => { dragging = false; }, true);
}

type Mode = null | 'peek' | 'open';

export function Term({ id, children }: { id: string; children?: ReactNode }) {
  const info = useSiteInfo();
  const g = info?.gloss[id];
  const lang = info?.lang ?? 'en';
  const [mode, setMode] = useState<Mode>(null);
  const [pos, setPos] = useState<{ left: number; top: number; width: number; sheet: boolean } | null>(null);
  const trig = useRef<HTMLSpanElement>(null);
  const card = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | null>(null);
  const quiet = useRef(false); // focus handed back after Esc or the close button must not reopen the card
  const uid = useId();

  const place = useCallback(() => {
    const t = trig.current;
    if (!t) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    if (vw < 560) { setPos({ left: 0, top: 0, width: vw, sheet: true }); return; }
    const r = t.getBoundingClientRect();
    const width = Math.min(380, vw - 32);
    const left = Math.max(16, Math.min(r.left, vw - width - 16));
    const h = card.current?.offsetHeight ?? 260;
    const below = r.bottom + 8;
    const top = below + h > vh - 8 && r.top - 8 - h > 8 ? r.top - 8 - h : Math.min(below, Math.max(8, vh - h - 8));
    setPos({ left, top, width, sheet: false });
  }, []);

  useLayoutEffect(() => { if (mode) place(); }, [mode, place]);

  useEffect(() => {
    if (!mode) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); setMode(null); quiet.current = true; trig.current?.focus(); } };
    const onDown = (e: PointerEvent) => {
      const n = e.target as Node;
      if (trig.current?.contains(n) || card.current?.contains(n)) return;
      setMode(null);
    };
    const onMove = () => place();
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [mode, place]);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  if (!g) return <>{children}</>;
  const canHover = () => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clear = () => { if (timer.current) { window.clearTimeout(timer.current); timer.current = null; } };
  const peek = () => { if (!canHover() || mode === 'open' || dragging) return; clear(); timer.current = window.setTimeout(() => setMode((m) => m ?? 'peek'), 250); };
  const unpeek = () => { clear(); if (mode === 'peek' || mode === null) timer.current = window.setTimeout(() => setMode((m) => (m === 'peek' ? null : m)), 180); };
  const toggle = () => { clear(); setMode((m) => (m === 'open' ? null : 'open')); };
  const w = W[lang];
  const cardId = `gn-term-${uid}`;

  return (
    <span className="gn-term">
      <span ref={trig} className="gn-term__label" role="button" tabIndex={0} aria-expanded={mode === 'open'} aria-controls={mode ? cardId : undefined} aria-describedby={mode === 'peek' ? cardId : undefined}
        aria-label={`${typeof children === 'string' ? children : g.term}: ${w.more}`}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(); }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}
        onMouseEnter={peek} onMouseLeave={unpeek}
        onFocus={(e) => { if (quiet.current) { quiet.current = false; return; } if (!dragging && e.currentTarget.matches(':focus-visible')) setMode((m) => m ?? 'peek'); }}
        onBlur={(e) => { if (!card.current?.contains(e.relatedTarget as Node)) setMode((m) => (m === 'peek' ? null : m)); }}>
        {children ?? g.term}<span className="gn-term__i" aria-hidden="true">ⓘ</span>
      </span>
      {mode && (
        <span ref={card} id={cardId} role={mode === 'open' ? 'dialog' : 'tooltip'} aria-label={g.term}
          className={`gn-pop${pos?.sheet ? ' gn-pop--sheet' : ''}${mode === 'peek' ? ' gn-pop--peek' : ''}`}
          style={pos && !pos.sheet ? { left: pos.left, top: pos.top, width: pos.width } : pos?.sheet ? undefined : { visibility: 'hidden' }}
          onMouseEnter={clear} onMouseLeave={unpeek} onClick={(e) => e.stopPropagation()}>
          <span className="gn-pop__head">
            <span className="gn-pop__term">{g.term}</span>
            {mode === 'open' && <button type="button" className="gn-pop__close" onClick={() => { setMode(null); quiet.current = true; trig.current?.focus(); }} aria-label={w.close}>×</button>}
          </span>
          {PARTS.map((k) => g[k] ? (
            <span className="gn-pop__sec" key={k}><span className="gn-pop__k">{w[k]}</span><span className="gn-pop__v">{g[k]}
              {k === 'calc' && g.formula && <code className="gn-pop__formula">{g.formula}</code>}</span></span>
          ) : null)}
          {g.src.length > 0 && <span className="gn-pop__sec gn-pop__src"><span className="gn-pop__k">{w.src}</span><CiteList items={g.src} lang={lang} reads={info?.reads} inline /></span>}
        </span>
      )}
    </span>
  );
}
