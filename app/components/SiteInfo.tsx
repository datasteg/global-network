'use client';
// What every page's client pieces need from the build without reading data themselves: the glossary in the page's
// language (with this build's examples filled in) and the days each source was read. Provided once by the layout.
import { createContext, useContext, type ReactNode } from 'react';
import type { Gloss } from '@/lib/glossary';
import type { Lang } from '@/lib/types';

export interface Info { lang: Lang; gloss: Record<string, Gloss>; reads: { vintages: Record<string, string>; wdi: string; trade: string } }

const Ctx = createContext<Info | null>(null);

export function SiteInfoProvider({ value, children }: { value: Info; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSiteInfo(): Info | null {
  return useContext(Ctx);
}
