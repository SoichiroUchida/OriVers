import { useState, type FC } from 'react';
import type { DKResult, Shape } from '../../types';
import { cssVar } from '../../hooks/useCssVar';

interface Props { result: DKResult | null; shape: Shape; running: boolean }

function fitBox(pts: number[][], pad: number) {
  let a=Infinity,b=Infinity,c=-Infinity,d=-Infinity;
  for (const p of pts) { a=Math.min(a,p[0]);b=Math.min(b,p[1]);c=Math.max(c,p[0]);d=Math.max(d,p[1]); }
  const s=Math.max(c-a,d-b)*(1+2*pad),cx=(a+c)/2,cy=(b+d)/2;
  return { tf:(p:number[])=>[(p[0]-(cx-s/2))/s, 1-(p[1]-(cy-s/2))/s] };
}

function pathOf(rings: number[][][], tf: (p:number[])=>number[]): string {
  return rings.map(R => 'M'+R.map(p=>{const q=tf(p);return q[0].toFixed(5)+' '+q[1].toFixed(5);}).join('L')+'Z').join('');
}

const FoldView: FC<Props> = ({ result, shape, running }) => {
  const [showEdges, setShowEdges] = useState(false);

  if (!result) {
    const muted = cssVar('--muted');
    return (
      <section className="view dkview">
        <h3>(c) 完成形（上から見た図）</h3>
        <p className="cap">層順序に従って各セルの最上層を描画。点線が ∂<i>T</i>。</p>
        <svg viewBox="0 0 1 1">
          {running && <text x={0.5} y={0.5} textAnchor="middle" fontSize={0.045} fill={muted}>計算中…</text>}
        </svg>
      </section>
    );
  }

  const R = result;
  const s = R.cand.faces.map(f => f.s);
  const pts: number[][] = [];
  for (const p of R.pieces) for (const q of p.poly) pts.push(q);
  for (const t of shape.T) for (const q of t) pts.push(q);
  const { tf } = fitBox(pts, 0.03);

  let dF = '', dB = '';
  for (const p of R.pieces) {
    const d = pathOf([p.poly], tf);
    if (s[p.top] < 0) dB += d; else dF += d;
  }

  const tBoundary = pathOf([...shape.T, ...shape.holes], tf);

  return (
    <section className="view dkview">
      <h3>(c) 完成形（上から見た図）</h3>
      <p className="cap">層順序に従って各セルの最上層を描画。点線が ∂<i>T</i>。<i>T</i> の外に見える紙は必ず表（白）です（キャップ定理）。</p>
      <svg viewBox="0 0 1 1">
        <path d={dF} fill="#F4EBDD" stroke="#F4EBDD" strokeWidth={0.0012} strokeLinejoin="round" />
        <path d={dB} fill="#2E5A87" stroke="#2E5A87" strokeWidth={0.0012} strokeLinejoin="round" />
        {showEdges && R.cand.faces.map((f, i) => (
          <path key={i} d={pathOf([f.F], tf)} fill="none" stroke="#7a6a55" strokeOpacity={0.35} strokeWidth={0.0012} />
        ))}
        <path d={tBoundary} fill="none" stroke="#c9873a" strokeWidth={0.004} strokeDasharray="0.012 0.008" />
      </svg>
      <div className="legend">
        <span><i className="sw" style={{ background: '#F4EBDD' }} />表面</span>
        <span><i className="sw" style={{ background: '#2E5A87' }} />裏面</span>
      </div>
      <div className="toggles">
        <label><input type="checkbox" checked={showEdges} onChange={e => setShowEdges(e.target.checked)} /> 面の輪郭を重ねる</label>
      </div>
    </section>
  );
};

export default FoldView;
