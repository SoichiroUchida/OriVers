import { useCallback, useRef } from 'react';
import type { DKResult, DKFailResult, LogEntry, Shape, StripResult } from '../types';

type WorkerMsg =
  | { type: 'progress'; entry: LogEntry }
  | { type: 'done'; result: DKResult | DKFailResult }
  | { type: 'sdone'; result: StripResult }
  | { type: 'error'; message: string };

function fmtEntry(x: LogEntry): string {
  return `候補 #${x.k}${x.protrusion != null && isFinite(x.protrusion) ? `（折り込み後のはみ出し≈${(100 * x.protrusion).toFixed(1)}%）` : ''}  φ=${x.phase} seed=${x.seed}  面 ${x.n}  変数 ${x.vars}  節 ${x.clauses}  → ${x.status === 'sat' ? 'SAT' : x.status === 'unsat' ? 'UNSAT' : x.status}  (${Math.round(x.ms)} ms)`;
}

interface ComputeCallbacks {
  onLog: (line: string) => void;
  onDKDone: (result: DKResult | DKFailResult) => void;
  onStripDone: (result: StripResult) => void;
  onError: (msg: string) => void;
}

export function useCompute() {
  const workerRef = useRef<Worker | null>(null);

  const terminate = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
  }, []);

  const makeWorker = useCallback((cb: ComputeCallbacks): Worker | null => {
    try {
      // Use static public/worker.js so importScripts('/orivers.js') works
      const w = new Worker('/worker.js');
      w.onmessage = (e: MessageEvent<WorkerMsg>) => {
        const m = e.data;
        if (m.type === 'progress') cb.onLog(fmtEntry(m.entry));
        else if (m.type === 'done') { terminate(); cb.onDKDone(m.result); }
        else if (m.type === 'sdone') { terminate(); cb.onStripDone(m.result); }
        else if (m.type === 'error') { terminate(); cb.onError(m.message); }
      };
      w.onerror = (e) => { terminate(); cb.onError(e.message || 'Worker error'); };
      return w;
    } catch {
      return null;
    }
  }, [terminate]);

  const computeDK = useCallback((
    shape: Shape,
    paper: string,
    maxC: number,
    foldIn: boolean,
    cb: ComputeCallbacks
  ) => {
    terminate();
    const msg = { T: shape.T, holes: shape.holes, paper, maxC, foldIn };
    const OV = window.OriVers;
    const runMain = () => {
      setTimeout(() => {
        try {
          const r = OV.solveShape(shape.T, shape.holes, {
            cap: true, paper, maxCandidates: maxC, foldIn,
            onProgress: (x) => cb.onLog(fmtEntry(x)),
          }) as Record<string, unknown>;
          if (!r.ok) { cb.onDKDone(r as unknown as DKFailResult); return; }
          const M = r.model as Record<string, unknown>;
          cb.onDKDone({
            ok: true,
            paperKindUsed: r.paperKindUsed as string,
            paperKind: r.paperKindUsed as string,
            shapeName: shape.name,
            foldin: r.foldin as DKResult['foldin'],
            log: r.log as LogEntry[],
            tried: r.tried as number,
            ms: r.ms as number,
            cand: r.cand as DKResult['cand'],
            P: r.P as number[],
            creases: r.creases as DKResult['creases'],
            check: r.check as DKResult['check'],
            maekawa: r.maekawa as DKResult['maekawa'],
            violated: r.violated as number,
            info: M.info as DKResult['info'],
            capInfo: M.capInfo as DKResult['capInfo'],
            nStrong: M.nStrong as number,
            n: M.n as number,
            W: M.W as number,
            ovPairs: M.ovPairs as DKResult['ovPairs'],
            edges: M.edges as DKResult['edges'],
            pieces: M.pieces as DKResult['pieces'],
          } as DKResult);
        } catch (e) {
          cb.onError((e as Error).message);
        }
      }, 30);
    };

    const w = makeWorker(cb);
    if (w) {
      workerRef.current = w;
      w.onerror = () => { workerRef.current = null; runMain(); };
      w.postMessage(msg);
    } else {
      runMain();
    }
  }, [terminate, makeWorker]);

  const computeStrip = useCallback((
    shape: Shape,
    opt: { w: number; trials: number; maxRows: number; gap: number; close: boolean; skipI: boolean; randLines: boolean },
    cb: ComputeCallbacks
  ) => {
    terminate();
    const msg = { mode: 'strip', T: shape.T, holes: shape.holes, opt };
    const OV = window.OriVers;
    const runMain = () => {
      setTimeout(() => {
        try {
          const r = OV.stripMethod(shape.T, shape.holes, opt);
          cb.onStripDone(r);
        } catch (e) {
          cb.onError((e as Error).message);
        }
      }, 30);
    };

    const w = makeWorker(cb);
    if (w) {
      workerRef.current = w;
      w.onerror = () => { workerRef.current = null; runMain(); };
      w.postMessage(msg);
    } else {
      runMain();
    }
  }, [terminate, makeWorker]);

  return { computeDK, computeStrip, terminate };
}
