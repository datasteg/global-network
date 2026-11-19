'use client';
// A structured source line: one item per dataset with its name linked to the dataset page, the publisher and licence,
// the series codes used (each linked where the publisher has a series page), the period and frequency, the day it was
// read, and the method page of the pipeline it came through. Built from lib/sources.ts, never free text.
import type { ReactNode } from 'react';
import { day } from '@/lib/format';
import { SERIES, SOURCES, VIA, srcUrl, type CiteItem } from '@/lib/sources';
import type { Lang } from '@/lib/types';
import { useSiteInfo } from './SiteInfo';

const W = {
  en: { source: 'Sources', read: 'read', via: 'via', method: 'method' },
  ko: { source: '출처', read: '수집', via: '경유', method: '방법론' },
};

/** The items as a list; `inline` uses spans so the list can sit inside a phrase (the glossary card). */
export function CiteList({ items, lang, reads, inline }: { items: CiteItem[]; lang: Lang; reads?: { vintages: Record<string, string>; wdi: string; trade: string } | null; inline?: boolean }) {
  const w = W[lang];
  const List = inline ? 'span' : 'ul', Item = inline ? 'span' : 'li';
  return (
    <List className="gn-cite__list">
      {items.map((it, i) => {
        const d = SOURCES[it.src];
        const read = it.src === 'wdi' ? reads?.wdi : d.vintage ? reads?.vintages[d.vintage] : d.via === 'trade' ? reads?.trade : undefined;
        return (
          <Item key={`${it.src}${i}`} className="gn-cite__item">
            <a href={srcUrl(d.url, lang)} rel="noopener">{d.name[lang]}</a>
            <span className="gn-cite__pub"> · {d.publisher[lang]}, {d.licence[lang]}</span>
            {it.series && it.series.length > 0 && (
              <span className="gn-cite__codes"> · {it.series.map((s, k) => {
                const sd = SERIES[s];
                return (<span key={s}>{k > 0 ? ', ' : ''}{sd?.url ? <a href={sd.url} rel="noopener"><code>{s}</code></a> : <code>{s}</code>}</span>);
              })}</span>
            )}
            {it.period && <span> · {it.period}</span>}
            {read && <span> · {w.read} {day(read, lang)}</span>}
            {d.via && <span> · {w.via} <a href={VIA[d.via].url(lang)} rel="noopener">{VIA[d.via].name} {w.method}</a></span>}
          </Item>
        );
      })}
    </List>
  );
}

export function Cite({ items, children }: { items: CiteItem[]; children?: ReactNode }) {
  const info = useSiteInfo();
  const lang: Lang = info?.lang ?? 'en';
  return (
    <div className="gn-source gn-cite">
      <span className="gn-cite__h">{W[lang].source}</span>
      <CiteList items={items} lang={lang} reads={info?.reads} />
      {children && <p className="gn-cite__note">{children}</p>}
    </div>
  );
}
