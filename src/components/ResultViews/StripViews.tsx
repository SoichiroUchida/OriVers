import { useEffect, useRef, useState, type FC } from 'react';
import type { StripResult } from '../../types';
import { cssVar } from '../../hooks/useCssVar';

interface Props {
  sres: StripResult | null;
  srunning: boolean;
}

type Seg = [number, number, number, number, number]; // x1 y1 x2 y2 mv

function cvPrep(cv: HTMLCanvasElement, aspect = 1) {
  const r = cv.getBoundingClientRect();
  const W = Math.max(200, r.width || 400);
  const H = W * aspect;
  cv.style.aspectRatio = (1/aspect).toString();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = W * dpr; cv.height = H * dpr;
  const c = cv.getContext('2d')!;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, W, H);
  c.fillStyle = cssVar('--panel');
  c.fillRect(0, 0, W, H);
  return { c, W, H };
}

function cvFit(pts: number[][], W: number, H: number, pad = 0.03) {
  let a=Infinity,b=Infinity,c=-Infinity,d=-Infinity;
  for (const p of pts) { a=Math.min(a,p[0]);b=Math.min(b,p[1]);c=Math.max(c,p[0]);d=Math.max(d,p[1]); }
  const s = Math.min(W/(c-a||1), H/(d-b||1)) * (1-2*pad);
  const ox = (W-s*(c-a))/2, oy = (H-s*(d-b))/2;
  return { s, tf: (p:number[]) => [ox+(p[0]-a)*s, H-(oy+(p[1]-b)*s)] };
}

function cvPoly(ctx: CanvasRenderingContext2D, P: number[][], tf: (p:number[])=>number[]) {
  ctx.beginPath();
  P.forEach((p, i) => { const q = tf(p); if (i) ctx.lineTo(q[0],q[1]); else ctx.moveTo(q[0],q[1]); });
  ctx.closePath();
}

function cvMsg(cv: HTMLCanvasElement, t: string) {
  const { c, W, H } = cvPrep(cv);
  c.fillStyle = cssVar('--muted');
  c.font = '14px system-ui';
  c.textAlign = 'center';
  c.fillText(t, W/2, H/2);
}

function wrapStrip(segs: Seg[], L: number) {
  const n = Math.max(1, Math.round(Math.sqrt(L/2.6)));
  const len = L/n, gap = 0.6;
  const out: [number[], number[], number][] = [];
  for (const [x1,y1,x2,y2,mv] of segs) {
    const lo = Math.min(x1,x2), hi = Math.max(x1,x2);
    for (let k = Math.max(0,Math.floor(lo/len)); k <= Math.min(n-1,Math.floor(hi/len)); k++) {
      const a = k*len, b = (k+1)*len;
      let t0=0, t1=1;
      if (Math.abs(x2-x1)>1e-12) {
        const ta=(a-x1)/(x2-x1), tb=(b-x1)/(x2-x1);
        t0=Math.max(0,Math.min(ta,tb)); t1=Math.min(1,Math.max(ta,tb));
      }
      if (t1 < t0) continue;
      const P = (t:number): number[] => [x1+t*(x2-x1)-a, y1+t*(y2-y1)-k*(1+gap)];
      out.push([P(t0), P(t1), mv]);
    }
  }
  const frames: number[][][] = [];
  for (let k = 0; k < n; k++)
    frames.push([[0,-k*(1+gap)],[len,-k*(1+gap)],[len,1-k*(1+gap)],[0,1-k*(1+gap)]]);
  return { out, frames, n, len };
}

export const SBaseView: FC<Props> = ({ sres, srunning }) => {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const [cap, setCap] = useState('—');

  useEffect(() => {
    const cv = cvRef.current!;
    if (!sres) { cvMsg(cv, srunning ? '計算中…' : '「帯の方法で計算」を押してください'); return; }
    const R = sres;
    const { c, W, H } = cvPrep(cv);
    const pts = R.pieces.flatMap(p => p.poly);
    const { tf } = cvFit(pts, W, H);
    c.fillStyle = '#cfdcea'; c.strokeStyle = '#4d6f93'; c.lineWidth = 0.6;
    for (const P of R.pieces) { cvPoly(c, P.poly, tf); c.fill(); c.stroke(); }
    c.strokeStyle = '#7d8a96'; c.lineWidth = 0.4;
    for (const P of R.rows) { cvPoly(c, P, tf); c.stroke(); }
    c.strokeStyle = '#c9873a'; c.lineWidth = 2.2;
    for (const P of R.pieces) for (const [a,b] of P.owned) {
      const A = tf(a), B = tf(b);
      c.beginPath(); c.moveTo(A[0],A[1]); c.lineTo(B[0],B[1]); c.stroke();
    }
    c.strokeStyle = '#9a6fb0'; c.lineWidth = 0.7;
    for (const path of (R.ropes || [])) {
      c.beginPath();
      path.forEach((p,i) => { const q=tf(p); if(i) c.lineTo(q[0],q[1]); else c.moveTo(q[0],q[1]); });
      c.stroke();
    }
    setCap(`開き ${R.nOpen}（(0) ${R.info.step0}・(i) ${R.info.stepi}・(ii) ${R.info.stepii}）、片 ${R.pieces.length}、行 ${R.nRows}、尺度 λ = ${R.lam.toFixed(2)}、回転 ${(R.angle*180/Math.PI).toFixed(1)}°。`);
  }, [sres, srunning]);

  return (
    <section className="view sview">
      <h3>(e) 基底の分解：片・行・綱の経路</h3>
      <p className="cap">{cap}</p>
      <canvas ref={cvRef} style={{ width: '100%', aspectRatio: '1', display: 'block' }} />
      <div className="legend">
        <span><i className="sw" style={{ background: '#cfdcea' }} />片</span>
        <span><i style={{ borderColor: '#c9873a', borderTopWidth: 3 }} />持ち主の要る辺</span>
        <span><i style={{ borderColor: '#7d8a96' }} />行の境界</span>
        <span><i style={{ borderColor: '#9a6fb0' }} />綱の中心線</span>
      </div>
    </section>
  );
};

export const SStripView: FC<Props> = ({ sres, srunning }) => {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const [cap, setCap] = useState('—');
  const mount = cssVar('--mount'), valley = cssVar('--valley');

  useEffect(() => {
    const cv = cvRef.current!;
    if (!sres?.stripCP) { cvMsg(cv, srunning ? '計算中…' : sres?.tooBig ? '行が多すぎるため省略' : '—'); return; }
    const R = sres;
    const segs = (R.closedCP || R.stripCP) as Seg[];
    const w = wrapStrip(segs, R.L);
    const { c, W, H } = cvPrep(cv, 0.75);
    const { tf } = cvFit(w.frames.flat(), W, H, 0.02);
    c.fillStyle = '#fbf8f2'; c.strokeStyle = cssVar('--ink'); c.lineWidth = 0.6;
    for (const F of w.frames) { cvPoly(c, F, tf); c.fill(); c.stroke(); }
    c.lineWidth = 0.5;
    for (const want of [1, 2]) {
      c.strokeStyle = want === 1 ? mount : valley;
      c.beginPath();
      for (const [a,b,mv] of w.out) {
        if (mv !== want) continue;
        const A = tf(a), B = tf(b);
        c.moveTo(A[0],A[1]); c.lineTo(B[0],B[1]);
      }
      c.stroke();
    }
    const nM = segs.filter(x => x[4] === 1).length;
    setCap(`帯 [0, ${R.L}] × [0, 1] を ${w.n} 段に折り返して表示。折線 ${segs.length}（山 ${nM}・谷 ${segs.length-nM}）。面 ${R.nClosed||R.nStripFaces}。`);
  }, [sres, srunning, mount, valley]);

  return (
    <section className="view sview">
      <h3>(f) 帯 <i>Q</i> の展開図（閉じた後）</h3>
      <p className="cap">{cap}</p>
      <canvas ref={cvRef} style={{ width: '100%', aspectRatio: '1', display: 'block' }} />
      <div className="legend">
        <span><i style={{ borderColor: 'var(--mount)' }} />山折り</span>
        <span><i style={{ borderColor: 'var(--valley)' }} />谷折り</span>
      </div>
    </section>
  );
};

export const SFoldView: FC<Props & { showPhi: boolean; onPhiChange: (v:boolean)=>void }> = ({ sres, srunning, showPhi, onPhiChange }) => {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const [cap, setCap] = useState('—');

  useEffect(() => {
    const cv = cvRef.current!;
    if (!sres?.folded) { cvMsg(cv, srunning ? '計算中…' : sres?.tooBig ? '行が多すぎるため省略' : '—'); return; }
    const R = sres;
    const F = showPhi ? R.phiImage! : R.folded!;
    const { c, W, H } = cvPrep(cv);
    const pts = showPhi ? F.flatMap(f => f[0]) : R.T.flat();
    const { tf } = cvFit(pts, W, H, showPhi ? 0.02 : 0.08);
    for (const [P, col] of F) {
      c.fillStyle = col ? '#2E5A87' : '#F4EBDD';
      c.strokeStyle = c.fillStyle; c.lineWidth = 0.3;
      cvPoly(c, P, tf); c.fill(); c.stroke();
    }
    c.strokeStyle = '#c9873a'; c.lineWidth = 1.4;
    c.setLineDash([5, 4]);
    const rings = showPhi ? R.pieces.map(p => p.poly) : R.T.concat(R.H);
    for (const P of rings) { cvPoly(c, P, tf); c.stroke(); }
    c.setLineDash([]);
    setCap(showPhi
      ? '閉じる前の帯の状態 Φ（壁に持ち主を要求しない実現）。点線は片。'
      : `閉じた後の帯の状態（λ 倍・回転した T の実現）。面 ${R.nClosed} を層順序の下から順に描画。点線は ∂T。`);
  }, [sres, srunning, showPhi]);

  return (
    <section className="view sview">
      <h3>(g) 完成形（各点の最上層の色）</h3>
      <p className="cap">{cap}</p>
      <canvas ref={cvRef} style={{ width: '100%', aspectRatio: '1', display: 'block' }} />
      <div className="legend">
        <span><i className="sw" style={{ background: '#F4EBDD' }} />表面（白）</span>
        <span><i className="sw" style={{ background: '#2E5A87' }} />裏面（色）</span>
        <span><i style={{ borderColor: '#c9873a', borderTopStyle: 'dashed' }} />∂<i>T</i></span>
      </div>
      <div className="toggles">
        <label><input type="checkbox" checked={showPhi} onChange={e => onPhiChange(e.target.checked)} /> 閉じる前の帯の状態 Φ を表示</label>
      </div>
    </section>
  );
};

export const SSquareView: FC<Props & { show: boolean }> = ({ sres, srunning, show }) => {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const [cap, setCap] = useState('左の「正方形の展開図も描く」をオンにすると描画します。');
  const mount = cssVar('--mount'), valley = cssVar('--valley');

  useEffect(() => {
    const cv = cvRef.current!;
    if (!show) { cvMsg(cv, '（オフ）'); setCap('左の「正方形の展開図も描く」をオンにすると描画します。'); return; }
    if (!sres?.closedCP) { cvMsg(cv, srunning ? '計算中…' : '—'); return; }
    const R = sres;
    const LIM = 1500000;
    const sq = window.OriVers.strip.squareCP(R.closedCP!, R.m, LIM);
    const { c, W, H } = cvPrep(cv);
    const L = sq.L;
    const s = Math.min(W,H)/L*0.97, o = (W-s*L)/2;
    c.fillStyle = '#fbf8f2'; c.fillRect(o,o,L*s,L*s);
    c.lineWidth = 0.4;
    for (const want of [1,2]) {
      c.strokeStyle = want === 1 ? mount : valley;
      c.beginPath();
      for (const [x1,y1,x2,y2,mv] of sq.segs) {
        if (mv !== want) continue;
        c.moveTo(o+x1*s, H-(o+y1*s)); c.lineTo(o+x2*s, H-(o+y2*s));
      }
      c.stroke();
    }
    c.strokeStyle = cssVar('--ink'); c.strokeRect(o,o,L*s,L*s);
    setCap(`一辺 ${L} = 2·${R.m}+1 の正方形。帯の展開図を ${L} 層に引き戻し、蛇腹の折線 y = k を加えたもの。線分 ${sq.segs.length.toLocaleString()}${sq.truncated?'（上限で打ち切り）':''}。`);
  }, [sres, srunning, show, mount, valley]);

  return (
    <section className="view sview">
      <h3>(h) 正方形の展開図（蛇腹との合成）</h3>
      <p className="cap">{cap}</p>
      <canvas ref={cvRef} style={{ width: '100%', aspectRatio: '1', display: 'block' }} />
    </section>
  );
};

export const SStatsView: FC<Props> = ({ sres, srunning }) => {
  const rows: [string, string][] = [];
  if (srunning) {
    rows.push(['状態', '計算中…']);
  } else if (!sres) {
    rows.push(['状態', '—']);
  } else {
    const R = sres;
    rows.push(['開きの数', `${R.nOpen}（(0) ${R.info.step0}、(i) ${R.info.stepi}、(ii) ${R.info.stepii}、省略 ${R.info.stepiiSkipped}）`]);
    rows.push(['片／行', `${R.pieces.length}／${R.nRows}`]);
    rows.push(['尺度 λ', R.lam.toFixed(3)]);
    if (R.tooBig) { rows.push(['状態', '行の数が上限を超えたため分解のみ']); }
    else {
      rows.push(['帯の長さ L', `${R.L} = 2·${R.m}+1`]);
      rows.push(['帯の状態 Φ の面', String(R.nStripFaces)]);
      rows.push(['閉じた後の面', String(R.nClosed)]);
      rows.push(['綱の経路', `${R.stats.routes} 本、曲がり ${R.stats.turns}、偶奇の調整 ${R.stats.parityFix}、折線の間隔の問題 ${R.stats.crease}`]);
      rows.push(['経路の条件（他の片・行に入る面）', String(R.stats.routeViolations)]);
      if (R.sample) rows.push(['閉じた後の標本検査', `${R.sample.n} 点：n ≠ χ_T ${R.sample.badN}、最上層の色の違反 ${R.sample.badTop}、最下層が色 ${R.sample.badBot}`]);
      rows.push(['正方形', `一辺 ${R.L}、面 ≈ ${(R.nClosed*R.L).toLocaleString()}（${R.L} 層）`]);
      rows.push(['計算時間', `構築 ${R.ms.build} ms・閉じる ${R.ms.close} ms・展開図 ${(R.ms.cp||0)+(R.ms.cp2||0)} ms`]);
    }
  }

  return (
    <section className="view sview">
      <h3>(i) 統計</h3>
      <table className="stats">
        <tbody>
          {rows.map(([k,v],i) => <tr key={i}><td>{k}</td><td>{v}</td></tr>)}
        </tbody>
      </table>
    </section>
  );
};

export const StripDescView: FC = () => (
  <section className="view sview" style={{ gridColumn: '1/-1' }}>
    <h3>帯の方法（paper_v6 §5b–§5d、すべての段に証明あり・SAT なし）</h3>
    <ol className="cap" style={{ margin: '4px 0 0 18px', padding: 0, lineHeight: 1.6 }}>
      <li><b>帯の分解</b>：各頂点を通る直線で反射頂点が消え各片は凸になる。直線の向きは試行ごとに変え行の数が最小の分解を採用。</li>
      <li><b>尺度と行</b>：配置全体を λ 倍し、各片を持ち主の要る辺に平行な高さ (1/2, 1] の行に分ける。</li>
      <li><b>帯の状態 Φ</b>：紙 Q = [0, L] × [0, 1] を行の部品と綱の部品で順に置く。層順序は後の部品が上の辞書式順序で決まる。</li>
      <li><b>閉じる</b>：開きを逆順に全層の段折りで閉じる。壁は内部のジップになり紙 Q からの T の実現が得られる。</li>
      <li><b>正方形</b>：L = 2m + 1 とし一辺 L の正方形を蛇腹に折って帯 Q と合成する。</li>
    </ol>
    <p className="cap" style={{ marginTop: '6px' }}>注意：構成は有限だが大きい。行の数は尺度 λ で決まり数百行になることが多い。</p>
  </section>
);
