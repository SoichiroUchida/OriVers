import { useCallback, useRef, useState } from 'react';
import type { DKResult, DKFailResult, Shape, Mode, PaperKind, StripResult } from './types';
import { SHAPES } from './data/shapes';
import { useTheme } from './hooks/useTheme';
import { useCompute } from './hooks/useCompute';
import Header from './components/Header';
import ShapeInput from './components/ShapeInput/index';
import ComputePanel from './components/ComputePanel';
import ExportPanel from './components/ExportPanel';
import TargetView from './components/ResultViews/TargetView';
import CPView from './components/ResultViews/CPView';
import FoldView from './components/ResultViews/FoldView';
import StatsView from './components/ResultViews/StatsView';
import {
  SBaseView, SStripView, SFoldView, SSquareView, SStatsView, StripDescView
} from './components/ResultViews/StripViews';

const DEFAULT_SHAPE = SHAPES.find(s => s.name === 'square')!;

export default function App() {
  const { toggle: toggleTheme } = useTheme();
  const { computeDK, computeStrip } = useCompute();
  const mainRef = useRef<HTMLElement>(null);

  const [shape, setShape] = useState<Shape>({ name: DEFAULT_SHAPE.name, T: DEFAULT_SHAPE.T, holes: DEFAULT_SHAPE.holes });
  const [result, setResult] = useState<DKResult | null>(null);
  const [sres, setSres] = useState<StripResult | null>(null);
  const [running, setRunning] = useState(false);
  const [srunning, setSrunning] = useState(false);
  const [log, setLog] = useState('');
  const [mode, setMode] = useState<Mode>('dk');
  const [paper, setPaper] = useState<PaperKind>('auto');
  const [maxC, setMaxC] = useState(20);
  const [foldIn, setFoldIn] = useState(true);
  const [stripW, setStripW] = useState(3);
  const [stripTrials, setStripTrials] = useState(40);
  const [stripMaxRows, setStripMaxRows] = useState(3000);
  const [stripSquare, setStripSquare] = useState(false);
  const [showPhi, setShowPhi] = useState(false);

  const appendLog = useCallback((line: string) => {
    setLog(prev => prev + line + '\n');
  }, []);

  const handleCompute = useCallback((sh = shape, p = paper, mc = maxC, fi = foldIn) => {
    setLog('');
    setRunning(true);
    setResult(null);
    appendLog(`開始: ${sh.name}  紙=${p}  候補≤${mc}`);
    computeDK(sh, p, mc, fi, {
      onLog: appendLog,
      onDKDone: (res: DKResult | DKFailResult) => {
        setRunning(false);
        if (res.ok) {
          const r = res as DKResult;
          r.paperKind = r.paperKindUsed || p;
          r.shapeName = sh.name;
          setResult(r);
          appendLog(`完了: 候補 #${r.cand.index} で SAT（${r.tried} 個試行, 計 ${Math.round(r.ms)} ms）`);
          if (r.foldin) appendLog(r.foldin.ok
            ? `凸包へ折り込み: ${r.foldin.rounds+1} 周、再認証 OK（最大層数 ${r.foldin.maxLayersBefore} → ${r.check.max_layers}）`
            : '凸包へ折り込み: 再認証に失敗したため折り込み前の結果を表示します');
        } else {
          appendLog(`失敗: ${res.tried} 個の候補すべて UNSAT`);
        }
        if (window.matchMedia('(max-width:820px)').matches) {
          mainRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
      },
      onStripDone: () => {},
      onError: (msg) => { setRunning(false); appendLog('エラー: ' + msg); },
    });
  }, [shape, paper, maxC, foldIn, appendLog, computeDK]);

  const handleComputeStrip = useCallback((sh = shape) => {
    setLog('');
    setSrunning(true);
    setSres(null);
    const opt = { w: stripW, trials: Math.max(1, stripTrials), maxRows: Math.max(10, stripMaxRows), gap: 6, close: true, skipI: true, randLines: true };
    appendLog(`帯の方法: ${sh.name}  w=${opt.w}  試行 ${opt.trials}  行の上限 ${opt.maxRows}`);
    computeStrip(sh, opt, {
      onLog: appendLog,
      onDKDone: () => {},
      onStripDone: (r: StripResult) => {
        setSrunning(false);
        r.shapeName = sh.name;
        for (const l of r.log || []) appendLog(l);
        if (r.tooBig) appendLog(`行の数 ${r.nRows} が上限を超えたため分解だけを表示します`);
        else appendLog('完了');
        setSres(r);
      },
      onError: (msg) => { setSrunning(false); appendLog('エラー: ' + msg); },
    });
  }, [shape, stripW, stripTrials, stripMaxRows, appendLog, computeStrip]);

  const handleSetShape = useCallback((sh: Shape) => {
    setShape({ name: sh.name, T: sh.T.map(r => r.map(p => [...p] as [number,number])), holes: (sh.holes||[]).map(r => r.map(p => [...p] as [number,number])) });
    setResult(null);
    setSres(null);
    if (mode === 'dk') handleCompute(sh, paper, maxC, foldIn);
    else handleComputeStrip(sh);
  }, [mode, paper, maxC, foldIn, handleCompute, handleComputeStrip]);

  const handleModeChange = useCallback((m: Mode) => {
    setMode(m);
    if (m === 'strip' && !sres && !srunning) handleComputeStrip();
  }, [sres, srunning, handleComputeStrip]);

  const handlePaperChange = useCallback((p: PaperKind) => {
    setPaper(p);
    const newMaxC = p === 'legacy' && maxC === 20 ? 40 : p !== 'legacy' && maxC === 40 ? 20 : maxC;
    if (newMaxC !== maxC) setMaxC(newMaxC);
    handleCompute(shape, p, newMaxC, foldIn);
  }, [maxC, shape, foldIn, handleCompute]);

  const handleFoldInChange = useCallback((v: boolean) => {
    setFoldIn(v);
    handleCompute(shape, paper, maxC, v);
  }, [shape, paper, maxC, handleCompute]);

  const isDK = mode === 'dk';
  const isStrip = mode === 'strip';

  return (
    <>
      <Header onToggleTheme={toggleTheme} />
      <div className="wrap">
        <aside>
          <ShapeInput shape={shape} onSetShape={handleSetShape} />
          <ComputePanel
            mode={mode} paper={paper} maxCandidates={maxC} foldIn={foldIn}
            stripW={stripW} stripTrials={stripTrials} stripMaxRows={stripMaxRows} stripSquare={stripSquare}
            running={running} srunning={srunning} log={log}
            onModeChange={handleModeChange}
            onPaperChange={handlePaperChange}
            onMaxCChange={setMaxC}
            onFoldInChange={handleFoldInChange}
            onStripWChange={setStripW}
            onStripTrialsChange={setStripTrials}
            onStripMaxRowsChange={setStripMaxRows}
            onStripSquareChange={setStripSquare}
            onCompute={() => handleCompute()}
            onComputeStrip={() => handleComputeStrip()}
            onScrollToResults={() => mainRef.current?.scrollIntoView({ behavior: 'smooth' })}
          />
          <ExportPanel result={result} shape={shape} />
        </aside>

        <main ref={mainRef}>
          <TargetView shape={shape} />

          {isStrip && <StripDescView />}
          {isStrip && <SBaseView sres={sres} srunning={srunning} />}
          {isStrip && <SStripView sres={sres} srunning={srunning} />}
          {isStrip && <SFoldView sres={sres} srunning={srunning} showPhi={showPhi} onPhiChange={setShowPhi} />}
          {isStrip && <SSquareView sres={sres} srunning={srunning} show={stripSquare} />}
          {isStrip && <SStatsView sres={sres} srunning={srunning} />}

          {isDK && <CPView result={result} running={running} />}
          {isDK && <FoldView result={result} shape={shape} running={running} />}
          {isDK && <StatsView result={result} running={running} />}
        </main>
      </div>
    </>
  );
}
