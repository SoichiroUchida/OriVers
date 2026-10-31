import type { FC } from 'react';
import type { Mode, PaperKind } from '../types';

interface Props {
  mode: Mode;
  paper: PaperKind;
  maxCandidates: number;
  foldIn: boolean;
  stripW: number;
  stripTrials: number;
  stripMaxRows: number;
  stripSquare: boolean;
  running: boolean;
  srunning: boolean;
  log: string;
  onModeChange: (m: Mode) => void;
  onPaperChange: (p: PaperKind) => void;
  onMaxCChange: (n: number) => void;
  onFoldInChange: (v: boolean) => void;
  onStripWChange: (v: number) => void;
  onStripTrialsChange: (v: number) => void;
  onStripMaxRowsChange: (v: number) => void;
  onStripSquareChange: (v: boolean) => void;
  onCompute: () => void;
  onComputeStrip: () => void;
  onScrollToResults: () => void;
}

const ComputePanel: FC<Props> = (props) => {
  const {
    mode, paper, maxCandidates, foldIn, stripW, stripTrials, stripMaxRows, stripSquare,
    running, srunning, log,
    onModeChange, onPaperChange, onMaxCChange, onFoldInChange,
    onStripWChange, onStripTrialsChange, onStripMaxRowsChange, onStripSquareChange,
    onCompute, onComputeStrip, onScrollToResults,
  } = props;

  return (
    <div className="card">
      <h2>計算</h2>
      <div className="row">
        <label htmlFor="mode">方式</label>
        <select
          id="mode"
          value={mode}
          onChange={e => onModeChange(e.target.value as Mode)}
        >
          <option value="dk">DK+SAT（既存・正方形から直接）</option>
          <option value="strip">帯の方法（一般の T・証明つき）</option>
        </select>
      </div>

      {mode === 'strip' && (
        <div id="strip-opts">
          <div className="row">
            <label htmlFor="st-w" title="開きの幅 w">開きの幅 w</label>
            <input type="number" id="st-w" value={stripW} min={0.2} max={20} step={0.5}
              style={{ width: '70px' }} onChange={e => onStripWChange(+e.target.value)} />
            <label htmlFor="st-trials" title="試行回数">試行</label>
            <input type="number" id="st-trials" value={stripTrials} min={1} max={200}
              style={{ width: '60px' }} onChange={e => onStripTrialsChange(+e.target.value)} />
          </div>
          <div className="row">
            <label htmlFor="st-max">行の数の上限</label>
            <input type="number" id="st-max" value={stripMaxRows} min={10} max={20000} step={100}
              style={{ width: '80px' }} onChange={e => onStripMaxRowsChange(+e.target.value)} />
            <label>
              <input type="checkbox" checked={stripSquare} onChange={e => onStripSquareChange(e.target.checked)} />
              {' '}正方形の展開図も描く（大きい）
            </label>
          </div>
          <div className="row">
            <button type="button" className="primary" style={{ marginLeft: 'auto' }}
              onClick={onComputeStrip} disabled={srunning}>
              {srunning ? '計算中…' : '帯の方法で計算'}
            </button>
          </div>
        </div>
      )}

      {mode === 'dk' && (
        <div id="dk-opts">
          <div className="row">
            <label htmlFor="paperkind">紙の形</label>
            <select id="paperkind" value={paper} onChange={e => onPaperChange(e.target.value as PaperKind)}>
              <option value="auto">正方形（自動：2 種の境界割当を順に試す）</option>
              <option value="square">正方形（鋭い下界）</option>
              <option value="tri">正三角形</option>
              <option value="hex">正六角形</option>
              <option value="legacy">正方形（旧境界割当・論文図）</option>
            </select>
          </div>
          <div className="row">
            <label htmlFor="foldin" title="凸包へ折り込む">凸包へ折り込む（安全な線のみ）</label>
            <input type="checkbox" id="foldin" checked={foldIn} onChange={e => onFoldInChange(e.target.checked)} />
            <label htmlFor="maxc">候補数上限</label>
            <input type="number" id="maxc" value={maxCandidates} min={1} max={60}
              style={{ width: '70px' }} onChange={e => onMaxCChange(Math.max(1, Math.min(60, +e.target.value || 20)))} />
            <button type="button" className="primary" style={{ marginLeft: 'auto' }}
              onClick={onCompute} disabled={running}>
              {running ? '計算中…' : '計算する'}
            </button>
            <button type="button" className="tores-btn" style={{ display: 'none' }}
              onClick={onScrollToResults}>結果を見る ↓</button>
          </div>
        </div>
      )}

      {log && <div className="progress-log">{log}</div>}
    </div>
  );
};

export default ComputePanel;
