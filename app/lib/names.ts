// Short names of economies that appear as partners but are outside the board set. The board's 36 and the hub come
// from meta.json; these cover the rest of the top-partner lists (en, ko). Anything missing falls back to the ISO3 code.
import { readMeta } from './data';
import type { Lang } from './types';

const EXTRA: Record<string, { en: string; ko: string }> = {
  VNM: { en: 'Vietnam', ko: '베트남' }, TWN: { en: 'Taiwan', ko: '대만' }, HKG: { en: 'Hong Kong SAR', ko: '홍콩' }, SGP: { en: 'Singapore', ko: '싱가포르' },
  NLD: { en: 'Netherlands', ko: '네덜란드' }, CHE: { en: 'Switzerland', ko: '스위스' }, IRL: { en: 'Ireland', ko: '아일랜드' }, LUX: { en: 'Luxembourg', ko: '룩셈부르크' },
  ARE: { en: 'UAE', ko: '아랍에미리트' }, QAT: { en: 'Qatar', ko: '카타르' }, KWT: { en: 'Kuwait', ko: '쿠웨이트' }, IRQ: { en: 'Iraq', ko: '이라크' }, IRN: { en: 'Iran', ko: '이란' }, OMN: { en: 'Oman', ko: '오만' }, BHR: { en: 'Bahrain', ko: '바레인' }, YEM: { en: 'Yemen', ko: '예멘' }, EGY: { en: 'Egypt', ko: '이집트' },
  PHL: { en: 'Philippines', ko: '필리핀' }, PAK: { en: 'Pakistan', ko: '파키스탄' }, BGD: { en: 'Bangladesh', ko: '방글라데시' }, LKA: { en: 'Sri Lanka', ko: '스리랑카' }, KAZ: { en: 'Kazakhstan', ko: '카자흐스탄' },
  UKR: { en: 'Ukraine', ko: '우크라이나' }, BLR: { en: 'Belarus', ko: '벨라루스' }, SVK: { en: 'Slovakia', ko: '슬로바키아' }, SVN: { en: 'Slovenia', ko: '슬로베니아' }, ROU: { en: 'Romania', ko: '루마니아' }, BGR: { en: 'Bulgaria', ko: '불가리아' }, HRV: { en: 'Croatia', ko: '크로아티아' }, SRB: { en: 'Serbia', ko: '세르비아' }, LTU: { en: 'Lithuania', ko: '리투아니아' }, LVA: { en: 'Latvia', ko: '라트비아' }, EST: { en: 'Estonia', ko: '에스토니아' },
  PER: { en: 'Peru', ko: '페루' }, ECU: { en: 'Ecuador', ko: '에콰도르' }, URY: { en: 'Uruguay', ko: '우루과이' }, PRY: { en: 'Paraguay', ko: '파라과이' }, BOL: { en: 'Bolivia', ko: '볼리비아' }, VEN: { en: 'Venezuela', ko: '베네수엘라' }, PAN: { en: 'Panama', ko: '파나마' }, CRI: { en: 'Costa Rica', ko: '코스타리카' }, GTM: { en: 'Guatemala', ko: '과테말라' }, DOM: { en: 'Dominican Rep.', ko: '도미니카공화국' },
  NGA: { en: 'Nigeria', ko: '나이지리아' }, MAR: { en: 'Morocco', ko: '모로코' }, DZA: { en: 'Algeria', ko: '알제리' }, TUN: { en: 'Tunisia', ko: '튀니지' }, GIN: { en: 'Guinea', ko: '기니' }, GHA: { en: 'Ghana', ko: '가나' }, KEN: { en: 'Kenya', ko: '케냐' }, AGO: { en: 'Angola', ko: '앙골라' }, COD: { en: 'DR Congo', ko: '콩고민주공화국' }, ZMB: { en: 'Zambia', ko: '잠비아' }, MOZ: { en: 'Mozambique', ko: '모잠비크' },
  CYM: { en: 'Cayman Islands', ko: '케이맨제도' }, BMU: { en: 'Bermuda', ko: '버뮤다' }, BHS: { en: 'Bahamas', ko: '바하마' }, VGB: { en: 'British Virgin Islands', ko: '영국령 버진아일랜드' }, JEY: { en: 'Jersey', ko: '저지' }, GGY: { en: 'Guernsey', ko: '건지' }, IMN: { en: 'Isle of Man', ko: '맨섬' }, MLT: { en: 'Malta', ko: '몰타' }, CYP: { en: 'Cyprus', ko: '키프로스' }, MAC: { en: 'Macao SAR', ko: '마카오' }, PAN_: { en: 'Panama', ko: '파나마' }, MUS: { en: 'Mauritius', ko: '모리셔스' },
  ISL: { en: 'Iceland', ko: '아이슬란드' }, KHM: { en: 'Cambodia', ko: '캄보디아' }, MMR: { en: 'Myanmar', ko: '미얀마' }, LAO: { en: 'Laos', ko: '라오스' }, MNG: { en: 'Mongolia', ko: '몽골' }, PNG: { en: 'Papua New Guinea', ko: '파푸아뉴기니' }, NCL: { en: 'New Caledonia', ko: '뉴칼레도니아' },
  EMU: { en: 'Euro area', ko: '유로 지역' }, 'BIS:5A': { en: 'All BIS reporters', ko: 'BIS 보고국 전체' },
};

let cache: Record<string, { en: string; ko: string }> | null = null;
let cacheBuilt = '';
export function allNames(): Record<string, { en: string; ko: string }> {
  const m = readMeta();
  if (cache && cacheBuilt === m.built) return cache;   // a new data build (dev, tests) names its own partners
  const out: Record<string, { en: string; ko: string }> = { ...EXTRA };
  // partner nodes the build named: partner 490's own node takes the registry's name (asia_nes), never Taiwan's;
  // a Korean name still waiting for qkr falls back to the English one
  for (const [k, v] of Object.entries(m.partner_names ?? {})) if (!v.economy || !out[k]) out[k] = { en: v.en, ko: v.ko || v.en };
  for (const e of m.economies) out[e.code] = { en: e.en, ko: e.ko };
  for (const [k, v] of Object.entries(m.hub_names)) out[k] = { en: v.en, ko: v.ko };
  cache = out;
  cacheBuilt = m.built;
  return out;
}
/** Whether a partner code is an economy (false for partner 490's node and other areas not elsewhere specified). */
export function isEconomy(code: string): boolean {
  const p = readMeta().partner_names?.[code];
  return p ? p.economy : true;
}
export function name(code: string, lang: Lang): string {
  const n = allNames()[code];
  return n ? n[lang] : code;
}
