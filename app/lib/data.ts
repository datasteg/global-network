// The built data (scripts/build.py → data/*.json.br), read on the server only from DATA_DIR. There is no data route:
// the browser receives only what a page draws. Everything here arrives through money-flow's and trade-flow's export
// surfaces (docs/SURFACES.md, rule G18); meta.surfaces records both.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { brotliDecompressSync } from 'node:zlib';
import type { Stress, StressEco, Board, Chains, Checks, Earn, Shock, ShockIndex, Changes, Country, Dollar, Lenders, Meta, PairHistory, Pairs, Pulse, Replay, Validation } from './types';

const ROOT = path.resolve(process.env.DATA_DIR ?? path.join(process.cwd(), '..', 'data'));
const cache = new Map<string, unknown>();
const MAX = 64;

export function readData<T>(rel: string): T {
  if (!/^[A-Za-z0-9_\-/]+$/.test(rel)) throw new Error(`bad data path ${rel}`);
  const hit = cache.get(rel);
  if (hit && process.env.NODE_ENV === 'production') return hit as T;
  const file = path.join(ROOT, `${rel}.json.br`);
  if (!existsSync(file)) throw new Error(`no data file ${rel}`);
  const v = JSON.parse(brotliDecompressSync(readFileSync(file)).toString('utf8')) as T;
  cache.set(rel, v);
  while (cache.size > MAX) cache.delete(cache.keys().next().value as string);
  return v;
}

export function hasData(rel: string): boolean {
  return existsSync(path.join(ROOT, `${rel}.json.br`));
}

export const readMeta = () => readData<Meta>('meta');
export const readBoard = () => readData<Board>('board');
export const readPulse = () => readData<Pulse>('pulse');
export const readChains = () => readData<Chains>('chains');
export const readPairs = () => readData<Pairs>('pairs');
export const readLenders = () => readData<Lenders>('lenders');
export const readDollar = () => readData<Dollar>('dollar');
export const readValidation = () => readData<Validation>('validation');
export const readChanges = () => readData<Changes>('changes');
export const readReplay = () => readData<Replay>('replay');
export const readEarn = () => readData<Earn>('earn');
export const readChecks = () => readData<Checks>('checks');
export const readShocks = () => (hasData('shocks') ? readData<ShockIndex>('shocks') : { replays: [] });
export const readShock = (id: string) => (hasData(`shocks/${id}`) ? readData<Shock>(`shocks/${id}`) : null);
export const readCountry = (code: string) => (hasData(`country/${code}`) ? readData<Country>(`country/${code}`) : null);
/** The pair's history file (A < B); null when the build wrote none for the pair. */
export const readPairHistory = (a: string, b: string) => { const [x, y] = [a, b].sort(); return hasData(`pairs/${x}-${y}`) ? readData<PairHistory>(`pairs/${x}-${y}`) : null; };
/** Stress signals (scripts/stress.py): the index with the grid and validation, and one economy's inputs and partners. */
export const readStress = () => (hasData('stress') ? readData<Stress>('stress') : null);
export const readStressEco = (code: string) => (/^[A-Z]{3}$/.test(code) && hasData(`stress/${code}`) ? readData<StressEco>(`stress/${code}`) : null);
