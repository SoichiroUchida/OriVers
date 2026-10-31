import { useState, type FC } from 'react';
import type { DKResult } from '../../types';
import { cssVar } from '../../hooks/useCssVar';

interface Props { result: DKResult | null; running: boolean }

function fitBox(pts: number[][], pad: number) {
  let a=Infinity,b=Infinity,c=-Infinity,d=-Infinity;
  for (const p of pts) { a=Math.min(a,p[0]);b=Math.min(b,p[1]);c=Math.max(c,p[0]);d=Math.max(d,p[1]); }
  const s=Math.max(c-a,d-b)*(1+2*pad),cx=(a+c)/2,cy=(b+d)/2;
  return { s, tf:(p:number[])=>[(p[0]-(cx-s/2))/s, 1-(p[1]-(cy-s/2))/s] };
}

const CPView: FC<Props> = ({ result, running }) => {
  const [showFlat, setShowFlat] = useState(false);

  if (!result) {
    const muted = cssVar('--muted');
    return (
      <section className="view dkview">
        <h3>(b) 展開図（折線パターン）</h3>
        <p className="cap">山谷は厳密な層順序から決定（上の面が裏向きなら谷）。</p>
        <svg viewBox="0 0 1 1">
          {running && <text x={0.5} y={0.5} textAnchor="middle" fontSize={0.045} fill={muted}>計算中…</text>}
        </svg>
      </section>
    );
  }

  const R = result;
  const paper = R.cand.paper;
  const { tf, s } = fitBox(paper, 0.03);
  const sw = 1/s;
  const panel = cssVar('--panel');
  const ink = cssVar('--ink');
  const muted = cssVar('--muted');
  const mount = cssVar('--mount');
  const valley = cssVar('--valley');
  const bad = cssVar('--bad');

  const paperPath = 'M' + paper.map(p => { const q=tf(p); return q[0].toFixed(5)+' '+q[1].toFixed(5); }).join('L') + 'Z';
  const nM = R.creases.filter(c => c.mv === 'M').length;

  return (
    <section className="view dkview">
      <h3>(b) 展開図（折線パターン）</h3>
      <p className="cap">
        紙の{({square:'正方形',legacy:'正方形',tri:'正三角形',hex:'正六角形',auto:'正方形'} as Record<string,string>)[R.paperKind]}（一辺 {R.W.toFixed(4)}）。
        山 {nM}・谷 {R.creases.length-nM}。山谷は層順序から決定（上の面が裏向き ⇔ 谷）。
      </p>
      <svg viewBox="0 0 1 1">
        <path d={paperPath} fill={panel} stroke={ink} strokeWidth={0.004} />
        {showFlat && R.edges.filter(e => e.kind === 'flat').map((e, i) => {
          const A = tf(e.pa), B = tf(e.pb);
          return <line key={i} x1={A[0]} y1={A[1]} x2={B[0]} y2={B[1]} stroke={muted} strokeOpacity={0.45} strokeWidth={sw*0.0015/0.003} />;
        })}
        {R.creases.map((c, i) => {
          const A = tf(c.a), B = tf(c.b);
          return (
            <line key={i}
              x1={A[0]} y1={A[1]} x2={B[0]} y2={B[1]}
              stroke={c.mv === 'M' ? mount : valley}
              strokeWidth={0.003}
              strokeDasharray={c.mv === 'V' ? '0.012 0.007' : 'none'}
              strokeLinecap="round"
            />
          );
        })}
        {R.maekawa.badPts.map((p, i) => {
          const q = tf(p);
          return <circle key={i} cx={q[0]} cy={q[1]} r={0.012} fill="none" stroke={bad} strokeWidth={0.004} />;
        })}
      </svg>
      <div className="legend">
        <span><i style={{ borderColor: mount }} />山折り</span>
        <span><i style={{ borderColor: valley, borderTopStyle: 'dashed' }} />谷折り</span>
        <span><i style={{ borderColor: muted, opacity: 0.5 }} />平坦な辺</span>
      </div>
      <div className="toggles">
        <label><input type="checkbox" checked={showFlat} onChange={e => setShowFlat(e.target.checked)} /> 平坦な辺を表示</label>
      </div>
    </section>
  );
};

export default CPView;
