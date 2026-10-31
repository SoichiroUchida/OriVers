// Web Worker for OriVers computation
// orivers.js is loaded via importScripts (classic worker)
// Vite note: this file is referenced with { type: 'classic' } so importScripts works
declare function importScripts(...urls: string[]): void;
importScripts('/orivers.js');

declare const OriVers: import('./types').OriVersLib;

type Msg =
  | { mode: 'strip'; T: number[][][]; holes: number[][][]; opt: unknown }
  | { mode?: 'dk'; T: number[][][]; holes: number[][][]; paper: string; maxC: number; foldIn: boolean };

function pack(r: Record<string, unknown>) {
  if (!r.ok) return { ok: false, log: r.log, tried: r.tried, ms: r.ms };
  const M = r.model as Record<string, unknown>;
  return {
    ok: true,
    paperKindUsed: r.paperKindUsed,
    foldin: r.foldin,
    log: r.log,
    tried: r.tried,
    ms: r.ms,
    cand: r.cand,
    P: r.P,
    creases: r.creases,
    check: r.check,
    maekawa: r.maekawa,
    violated: r.violated,
    info: (M as { info: unknown }).info,
    capInfo: (M as { capInfo: unknown }).capInfo,
    nStrong: (M as { nStrong: unknown }).nStrong,
    n: (M as { n: unknown }).n,
    W: (M as { W: unknown }).W,
    ovPairs: (M as { ovPairs: unknown }).ovPairs,
    edges: (M as { edges: { a: unknown; b: unknown; kind: unknown; pa: unknown; pb: unknown }[] }).edges.map(
      (e) => ({ a: e.a, b: e.b, kind: e.kind, pa: e.pa, pb: e.pb })
    ),
    pieces: (M as { pieces: { poly: unknown; cov: unknown; top: unknown; inT: unknown; tiny: unknown; area: unknown }[] }).pieces.map(
      (p) => ({ poly: p.poly, cov: p.cov, top: p.top, inT: p.inT, tiny: p.tiny, area: p.area })
    ),
  };
}

self.onmessage = (e: MessageEvent<Msg>) => {
  const m = e.data;
  if (m.mode === 'strip') {
    try {
      const r = OriVers.stripMethod(m.T as [number,number][][], m.holes as [number,number][][], m.opt);
      self.postMessage({ type: 'sdone', result: r });
    } catch (err) {
      self.postMessage({ type: 'error', message: String(err && (err as Error).stack || err) });
    }
    return;
  }
  try {
    const r = OriVers.solveShape(
      m.T as [number,number][][],
      m.holes as [number,number][][],
      {
        cap: true,
        paper: (m as { paper: string }).paper,
        maxCandidates: (m as { maxC: number }).maxC,
        foldIn: (m as { foldIn: boolean }).foldIn,
        onProgress: (x) => self.postMessage({ type: 'progress', entry: x }),
      }
    ) as Record<string, unknown>;
    self.postMessage({ type: 'done', result: pack(r) });
  } catch (err) {
    self.postMessage({ type: 'error', message: String(err && (err as Error).stack || err) });
  }
};
