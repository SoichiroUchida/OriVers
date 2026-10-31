// OriVers Web Worker — loaded as a classic script so importScripts works
importScripts('/orivers.js');

function pack(r) {
  if (!r.ok) return { ok: false, log: r.log, tried: r.tried, ms: r.ms };
  const M = r.model;
  return {
    ok: true, paperKindUsed: r.paperKindUsed, foldin: r.foldin, log: r.log,
    tried: r.tried, ms: r.ms, cand: r.cand, P: r.P, creases: r.creases,
    check: r.check, maekawa: r.maekawa, violated: r.violated,
    info: M.info, capInfo: M.capInfo, nStrong: M.nStrong, n: M.n, W: M.W, ovPairs: M.ovPairs,
    edges: M.edges.map(e => ({ a: e.a, b: e.b, kind: e.kind, pa: e.pa, pb: e.pb })),
    pieces: M.pieces.map(p => ({ poly: p.poly, cov: p.cov, top: p.top, inT: p.inT, tiny: p.tiny, area: p.area })),
  };
}

self.onmessage = e => {
  const m = e.data;
  if (m.mode === 'strip') {
    try {
      const r = OriVers.stripMethod(m.T, m.holes, m.opt);
      self.postMessage({ type: 'sdone', result: r });
    } catch (err) {
      self.postMessage({ type: 'error', message: String(err && err.stack || err) });
    }
    return;
  }
  try {
    const r = OriVers.solveShape(m.T, m.holes, {
      cap: true, paper: m.paper, maxCandidates: m.maxC, foldIn: m.foldIn,
      onProgress: x => self.postMessage({ type: 'progress', entry: x }),
    });
    self.postMessage({ type: 'done', result: pack(r) });
  } catch (err) {
    self.postMessage({ type: 'error', message: String(err && err.stack || err) });
  }
};
