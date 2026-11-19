// The Open Graph card every shared link shows, in Oreum's colours: Hyeopjae sand page,
// basalt ink, the sea off Seongsan for money, tangerine for trade. Fonts: IBM Plex Sans KR, the site's own text face,
// read from app/public/fonts (the Korean subset covers Hangul, so both editions render in their own language; satori
// reads woff, not woff2). Without the files satori falls back to its Latin face and the Korean card shows boxes.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import type { Lang } from './types';

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_TYPE = 'image/png';

const SAND = '#F5F2EA', BASALT = '#1C1F21', SEA = '#0B6B86', TANGERINE = '#E07B22', INK_3 = '#6F7679', LINE = '#D8D3C6';

type Font = { name: string; data: ArrayBuffer; weight: 600; style: 'normal' };
const FONTS = path.join(process.cwd(), 'public', 'fonts');

async function font(file: string): Promise<Font | null> {
  try {
    const buf = await readFile(path.join(FONTS, file));
    return { name: 'IBM Plex Sans KR', data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, weight: 600, style: 'normal' };
  } catch { return null; }
}

async function fonts(lang: Lang): Promise<Font[]> {
  const list = [await font('ibm-plex-sans-kr-latin-600-normal.woff')];
  if (lang === 'ko') list.push(await font('ibm-plex-sans-kr-korean-600-normal.woff'));
  return list.filter((f): f is Font => !!f);
}

/** Oreum's mark: three oreum as a low skyline, sea and basalt. */
function Mark() {
  return (
    <svg width="56" height="56" viewBox="0 0 24 24" fill="none">
      <path d="M1 19 C4 13, 7 11, 9.5 11 C11 11, 12 12.5, 13.5 13 C16 9, 18.5 8, 23 19 Z" fill={SEA} />
      <path d="M1 19 C3 16, 5 15, 7 15 C9 15, 10.5 17, 12.5 17.5 C14 16, 15.5 15.5, 17 16 C19 16.5, 21 18, 23 19 Z" fill={BASALT} fillOpacity="0.9" />
      <rect x="1" y="19" width="22" height="2" fill={BASALT} />
    </svg>
  );
}

export interface OgCardProps {
  lang: Lang;
  /** Small line over the title: the section ("Country sheet", "Shock replay"). */
  kicker: string;
  title: string;
  /** One line under the title. */
  sub?: string;
  /** The newest periods, bottom right: "Q2 2026 · Jul 2026". */
  period?: string;
  /** Two figures on the card (the country card: V and 12-month exports). */
  facts?: { label: string; value: string; tone: 'money' | 'trade' }[];
}

export async function ogCard(p: OgCardProps): Promise<ImageResponse> {
  const long = p.title.length > (p.lang === 'ko' ? 22 : 44);
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '56px 72px 52px', background: SAND, color: BASALT, fontFamily: '"IBM Plex Sans KR"', fontWeight: 600 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <Mark />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 34, letterSpacing: -0.5 }}>global-network</div>
            <div style={{ fontSize: 20, color: INK_3, letterSpacing: p.lang === 'ko' ? 0 : 2, textTransform: p.lang === 'ko' ? 'none' : 'uppercase' }}>{p.kicker}</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', fontSize: long ? 54 : 66, lineHeight: 1.12, letterSpacing: p.lang === 'ko' ? -1 : -1.5, wordBreak: 'keep-all' }}>{p.title}</div>
          {p.sub ? <div style={{ display: 'flex', fontSize: 26, color: INK_3, lineHeight: 1.35, maxWidth: 1000, wordBreak: 'keep-all' }}>{p.sub}</div> : null}
          {p.facts && p.facts.length > 0 ? (
            <div style={{ display: 'flex', gap: 40, marginTop: 10 }}>
              {p.facts.map((f, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', paddingLeft: 16, borderLeft: `4px solid ${f.tone === 'money' ? SEA : TANGERINE}` }}>
                  <div style={{ fontSize: 20, color: INK_3 }}>{f.label}</div>
                  <div style={{ fontSize: 44, letterSpacing: -1 }}>{f.value}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 22, color: INK_3, paddingTop: 20, borderTop: `1px solid ${LINE}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 14, height: 14, background: SEA }} /><div style={{ width: 14, height: 14, background: TANGERINE }} />
            <div>global-network.datasteg.com · datasteg</div>
          </div>
          {p.period ? <div style={{ display: 'flex' }}>{p.period}</div> : null}
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: await fonts(p.lang) },
  );
}
