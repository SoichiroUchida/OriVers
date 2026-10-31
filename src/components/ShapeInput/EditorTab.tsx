import { useState, useRef, useCallback, type FC } from 'react';
import type { Shape, Ring, Point } from '../../types';
import { cssVar } from '../../hooks/useCssVar';

interface Props {
  currentShape: Shape;
  onUse: (shape: Shape) => void;
}

type PolyEntry = { pts: Point[]; hole: boolean };

function pathOf(rings: Point[][], tf: (p: Point) => Point): string {
  return rings.map(R => 'M' + R.map(p => { const q = tf(p); return q[0].toFixed(5) + ' ' + q[1].toFixed(5); }).join('L') + 'Z').join('');
}

function signedArea(P: Point[]): number {
  let s = 0;
  for (let i = 0, n = P.length; i < n; i++) {
    const p = P[i], q = P[(i + 1) % n];
    s += p[0] * q[1] - q[0] * p[1];
  }
  return s / 2;
}

function orient(P: Point[]): boolean { return signedArea(P) > 0; }

function segX(a: Point, b: Point, c: Point, d: Point): boolean {
  const o = (p: Point, q: Point, r: Point) => Math.sign((q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]));
  return o(a,b,c)*o(a,b,d)<0 && o(c,d,a)*o(c,d,b)<0;
}

function simple(P: Point[]): boolean {
  const n = P.length;
  for (let i = 0; i < n; i++) for (let j = i+1; j < n; j++) {
    if (Math.abs(i-j) <= 1 || (i===0 && j===n-1)) continue;
    if (segX(P[i], P[(i+1)%n], P[j], P[(j+1)%n])) return false;
  }
  return true;
}

function crossesAny(P: Point[], polys: PolyEntry[]): boolean {
  for (const q of polys) {
    for (let i = 0; i < P.length; i++)
      for (let j = 0; j < q.pts.length; j++)
        if (segX(P[i], P[(i+1)%P.length], q.pts[j], q.pts[(j+1)%q.pts.length])) return true;
  }
  return false;
}

function ovInside(V: Point[], p: Point): boolean {
  let c = false;
  for (let i = 0, j = V.length-1; i < V.length; j = i++) {
    const a = V[i], b = V[j];
    if (((a[1] > p[1]) !== (b[1] > p[1])) && (p[0] < (b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])) c = !c;
  }
  return c;
}

const EditorTab: FC<Props> = ({ currentShape, onUse }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [polys, setPolys] = useState<PolyEntry[]>([]);
  const [cur, setCur] = useState<Point[]>([]);
  const [hover, setHover] = useState<Point | null>(null);
  const [snap, setSnap] = useState(true);
  const [msg, setMsg] = useState('クリックで頂点を追加。外周（成分）は複数可、穴は外周の内側に。座標は [0,1]²。');
  const [msgBad, setMsgBad] = useState(false);

  const showMsg = useCallback((t: string, bad = false) => { setMsg(t); setMsgBad(bad); }, []);

  const getSVGPoint = useCallback((ev: React.MouseEvent): Point => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX; pt.y = ev.clientY;
    const q = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    let x = q.x, y = 1 - q.y;
    if (snap) { x = Math.round(x * 20) / 20; y = Math.round(y * 20) / 20; }
    return [Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y))];
  }, [snap]);

  const edClose = useCallback((hole: boolean) => {
    if (cur.length < 3) { showMsg('3点以上必要です', true); return; }
    const P = [...cur];
    const ar = signedArea(P);
    if (Math.abs(ar) < 1e-4) { showMsg('面積がほぼ 0 です', true); return; }
    if (!simple(P)) { showMsg('自己交差しています', true); return; }
    if (crossesAny(P, polys)) { showMsg('他の多角形と交差しています', true); return; }
    if (!orient(P)) P.reverse();
    setPolys(prev => [...prev, { pts: P, hole }]);
    setCur([]);
    showMsg(hole ? '穴を追加しました' : '外周を追加しました');
  }, [cur, polys, showMsg]);

  const tf = (p: Point): Point => [p[0], 1 - p[1]];

  const Ts = polys.filter(p => !p.hole).map(p => p.pts);
  const Hs = polys.filter(p => p.hole).map(p => p.pts);
  const curDisplay = [...cur, ...(hover ? [hover] : [])].map(tf);

  const grid = cssVar('--grid');
  const line = cssVar('--line');
  const mount = cssVar('--mount');

  return (
    <div>
      <svg
        ref={svgRef}
        id="ed-svg"
        viewBox="-0.03 -0.03 1.06 1.06"
        aria-label="多角形エディタ"
        onClick={ev => {
          const p = getSVGPoint(ev);
          if (cur.length >= 3 && Math.hypot(p[0]-cur[0][0], p[1]-cur[0][1]) < 0.02) { edClose(false); return; }
          const l = cur[cur.length-1];
          if (l && l[0] === p[0] && l[1] === p[1]) return;
          setCur(prev => [...prev, p]);
        }}
        onMouseMove={ev => { setHover(getSVGPoint(ev)); }}
        onMouseLeave={() => setHover(null)}
      >
        {Array.from({ length: 21 }, (_, k) => {
          const t = k / 20;
          return (
            <g key={k}>
              <line x1={0} y1={t} x2={1} y2={t} stroke={grid} strokeWidth={k % 5 ? 0.0015 : 0.003} />
              <line x1={t} y1={0} x2={t} y2={1} stroke={grid} strokeWidth={k % 5 ? 0.0015 : 0.003} />
            </g>
          );
        })}
        <rect x={0} y={0} width={1} height={1} fill="none" stroke={line} strokeWidth={0.004} />
        {Ts.length > 0 && (
          <path
            d={pathOf([...Ts, ...Hs], tf)}
            fill="#2E5A87" fillOpacity={0.6} fillRule="evenodd"
            stroke="#2E5A87" strokeWidth={0.004}
          />
        )}
        {Hs.map((H, i) => (
          <path key={i} d={pathOf([H], tf)} fill="none" stroke="#c9873a" strokeWidth={0.004} strokeDasharray="0.015 0.01" />
        ))}
        {cur.length > 0 && (
          <>
            <polyline
              points={curDisplay.map(p => p.join(',')).join(' ')}
              fill="none" stroke={mount} strokeWidth={0.005}
            />
            {cur.map((p, i) => {
              const q = tf(p);
              return <circle key={i} cx={q[0]} cy={q[1]} r={i ? 0.008 : 0.013} fill={mount} />;
            })}
          </>
        )}
      </svg>

      <div className="row">
        <label>
          <input type="checkbox" checked={snap} onChange={e => setSnap(e.target.checked)} />
          {' '}グリッドに吸着 (1/20)
        </label>
      </div>

      <div className="ed-btns">
        <button type="button" onClick={() => edClose(false)}>外周として閉じる</button>
        <button type="button" onClick={() => edClose(true)}>穴として閉じる</button>
        <button type="button" onClick={() => setCur(prev => prev.slice(0, -1))}>1点戻す</button>
        <button type="button" onClick={() => setPolys(prev => prev.slice(0, -1))}>最後の多角形を削除</button>
        <button type="button" onClick={() => {
          setPolys([
            ...currentShape.T.map(p => ({ pts: p.map(q => [...q] as Point), hole: false })),
            ...currentShape.holes.map(p => ({ pts: p.map(q => [...q] as Point), hole: true })),
          ]);
          setCur([]);
        }}>表示中の形を読込</button>
        <button type="button" onClick={() => { setPolys([]); setCur([]); }}>全消去</button>
      </div>

      <div className="row">
        <label className="drop" style={{ flex: 1, padding: '6px' }}>
          JSON {'{T, holes}'} を読込
          <input type="file" accept=".json,application/json" onChange={e => {
            const f = e.target.files?.[0];
            if (!f) return;
            f.text().then(t => {
              const d = JSON.parse(t);
              if (!Array.isArray(d.T)) throw new Error('T がありません');
              setPolys([
                ...d.T.map((p: Ring) => ({ pts: p, hole: false })),
                ...(d.holes || []).map((p: Ring) => ({ pts: p, hole: true })),
              ]);
              setCur([]);
              showMsg('読み込みました（「この形を使う」で計算）');
            }).catch(err => showMsg('読み込み失敗: ' + err.message, true));
            e.target.value = '';
          }} />
        </label>
      </div>

      <p className="hint" style={{ color: msgBad ? 'var(--bad)' : undefined }}>{msg}</p>

      <div className="row">
        <button type="button" className="primary" style={{ width: '100%' }} onClick={() => {
          const finCur = [...cur];
          let finalPolys = [...polys];
          if (finCur.length >= 3) {
            if (!simple(finCur)) { showMsg('現在の線が自己交差しています', true); return; }
            finalPolys = [...finalPolys, { pts: finCur, hole: false }];
          }
          const T = finalPolys.filter(p => !p.hole).map(p => p.pts);
          const H = finalPolys.filter(p => p.hole).map(p => p.pts);
          if (!T.length) { showMsg('外周が1つ以上必要です', true); return; }
          for (const h of H) {
            if (!T.some(t => ovInside(t, h[0]))) { showMsg('穴がどの外周の内側にもありません', true); return; }
          }
          onUse({ name: 'custom', T, holes: H });
        }}>この形を使う</button>
      </div>
    </div>
  );
};

export default EditorTab;
