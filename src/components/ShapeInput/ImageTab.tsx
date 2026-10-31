import { useState, useRef, useCallback, useEffect, type FC } from 'react';
import type { Shape, Point, Ring } from '../../types';

interface Props {
  onUse: (shape: Shape) => void;
}

interface ImageData2 { data: Uint8ClampedArray; w: number; h: number }
interface ExtractedShape { T: Ring[]; holes: Ring[]; bin: Uint8Array; w: number; h: number }

function imgToBinary(data: Uint8ClampedArray, w: number, h: number, thresh: number, invert: boolean): Uint8Array {
  const bin = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const a = data[i*4+3]; if (a < 128) { bin[i] = 0; continue; }
    const lum = 0.299*data[i*4] + 0.587*data[i*4+1] + 0.114*data[i*4+2];
    let on = lum < thresh; if (invert) on = !on; bin[i] = on ? 1 : 0;
  }
  return bin;
}

function labelCC(bin: Uint8Array, w: number, h: number, target: number): { lab: Int32Array; n: number } {
  const lab = new Int32Array(w * h); let n = 0;
  const qx = new Int32Array(w * h), qy = new Int32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y*w+x; if (bin[i] !== target || lab[i]) continue;
    n++; let head = 0, tail = 0; qx[tail] = x; qy[tail] = y; tail++; lab[i] = n;
    while (head < tail) {
      const cx = qx[head], cy = qy[head]; head++;
      for (const d of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = cx+d[0], ny = cy+d[1];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny*w+nx; if (bin[j] !== target || lab[j]) continue;
        lab[j] = n; qx[tail] = nx; qy[tail] = ny; tail++;
      }
    }
  }
  return { lab, n };
}

function traceRegion(lab: Int32Array, w: number, h: number, id: number): Point[] | null {
  let sx = -1, sy = -1;
  for (let y = 0; y < h && sy < 0; y++) for (let x = 0; x < w; x++) if (lab[y*w+x] === id) { sx = x; sy = y; break; }
  if (sx < 0) return null;
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && lab[y*w+x] === id;
  const corner = (x: number, y: number, d: number): Point => d===0?[x,y]:d===1?[x+1,y]:d===2?[x+1,y+1]:[x,y+1];
  const pts: Point[] = []; let px = sx, py = sy, dir = 0, guard = 0; const limit = 8*w*h+1000;
  do {
    pts.push(corner(px, py, dir));
    const f = [[1,0],[0,1],[-1,0],[0,-1]][dir], l = [[0,-1],[1,0],[0,1],[-1,0]][dir];
    const fx = px+f[0], fy = py+f[1], lx = fx+l[0], ly = fy+l[1];
    if (inside(lx, ly)) { px = lx; py = ly; dir = (dir+3)%4; }
    else if (inside(fx, fy)) { px = fx; py = fy; }
    else dir = (dir+1)%4;
    if (++guard > limit) break;
  } while (!(px === sx && py === sy && dir === 0));
  return pts.length >= 4 ? pts : null;
}

function segDistPt(q: Point, a: Point, b: Point): number {
  const vx = b[0]-a[0], vy = b[1]-a[1], L2 = vx*vx+vy*vy;
  let t = L2 ? ((q[0]-a[0])*vx+(q[1]-a[1])*vy)/L2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(q[0]-a[0]-t*vx, q[1]-a[1]-t*vy);
}

function rdpOpen(pts: Point[], eps: number): Point[] {
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length-1] = 1;
  const stack: [number, number][] = [[0, pts.length-1]];
  while (stack.length) {
    const [a, b] = stack.pop()!; let best = -1, bi = -1;
    for (let i = a+1; i < b; i++) { const d = segDistPt(pts[i], pts[a], pts[b]); if (d > best) { best = d; bi = i; } }
    if (best > eps && bi > 0) { keep[bi] = 1; stack.push([a, bi], [bi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

function rdpClosed(pts: Point[], eps: number): Point[] {
  const n = pts.length; if (n < 4) return pts.slice();
  let far = 0, dmax = -1;
  for (let i = 1; i < n; i++) { const d = Math.hypot(pts[i][0]-pts[0][0], pts[i][1]-pts[0][1]); if (d > dmax) { dmax = d; far = i; } }
  const a = rdpOpen(pts.slice(0, far+1), eps), b = rdpOpen(pts.slice(far).concat([pts[0]]), eps);
  const out = a.slice(0,-1).concat(b.slice(0,-1));
  return out.length >= 3 ? out : pts.slice();
}

function extractShape(data: Uint8ClampedArray, w: number, h: number, opt: { thresh: number; eps: number; minArea: number; invert: boolean }): ExtractedShape {
  const bin = imgToBinary(data, w, h, opt.thresh, opt.invert);
  const fg = labelCC(bin, w, h, 1), bg = labelCC(bin, w, h, 0);
  const touch = new Uint8Array(bg.n+1);
  for (let x = 0; x < w; x++) {
    if (bg.lab[x]) touch[bg.lab[x]] = 1;
    if (bg.lab[(h-1)*w+x]) touch[bg.lab[(h-1)*w+x]] = 1;
  }
  for (let y = 0; y < h; y++) {
    if (bg.lab[y*w]) touch[bg.lab[y*w]] = 1;
    if (bg.lab[y*w+w-1]) touch[bg.lab[y*w+w-1]] = 1;
  }
  const S = Math.max(w, h), minA = opt.minArea * w * h;
  const norm = (P: Point[]): Point[] => P.map(q => [q[0]/S, (h-q[1])/S]);
  const Ts: Ring[] = [], Hs: Ring[] = [];
  for (let id = 1; id <= fg.n; id++) {
    const c = traceRegion(fg.lab, w, h, id); if (!c) continue;
    const p = rdpClosed(c, opt.eps); if (Math.abs(p.reduce((s,q,i,a)=>{const r=a[(i+1)%a.length];return s+q[0]*r[1]-r[0]*q[1];},0)/2) < minA) continue;
    Ts.push(norm(p));
  }
  for (let id = 1; id <= bg.n; id++) {
    if (touch[id]) continue;
    const c = traceRegion(bg.lab, w, h, id); if (!c) continue;
    const p = rdpClosed(c, opt.eps); if (Math.abs(p.reduce((s,q,i,a)=>{const r=a[(i+1)%a.length];return s+q[0]*r[1]-r[0]*q[1];},0)/2) < minA) continue;
    Hs.push(norm(p));
  }
  return { T: Ts, holes: Hs, bin, w, h };
}

const ImageTab: FC<Props> = ({ onUse }) => {
  const [img, setImg] = useState<ImageData2 | null>(null);
  const [thresh, setThresh] = useState(128);
  const [eps, setEps] = useState(15);
  const [minar, setMinar] = useState(30);
  const [invert, setInvert] = useState(false);
  const [stat, setStat] = useState('—');
  const [shape, setShape] = useState<ExtractedShape | null>(null);
  const [isDrop, setIsDrop] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const opt = { thresh, eps: eps/10, minArea: minar/10000, invert };

  const refresh = useCallback(() => {
    if (!img) return;
    try {
      const s = extractShape(img.data, img.w, img.h, opt);
      setShape(s);
      const cv = canvasRef.current!;
      const W = 220, H = Math.max(1, Math.round(W * img.h / img.w));
      cv.width = W; cv.height = H;
      const ctx = cv.getContext('2d')!;
      const out = ctx.createImageData(W, H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const on = s.bin[Math.min(img.h-1, Math.floor(y*img.h/H)) * img.w + Math.min(img.w-1, Math.floor(x*img.w/W))];
        const i = (y*W+x)*4;
        out.data[i] = on?46:255; out.data[i+1] = on?90:255; out.data[i+2] = on?135:255; out.data[i+3] = 255;
      }
      ctx.putImageData(out, 0, 0);
      const nv = s.T.reduce((a,p)=>a+p.length,0) + s.holes.reduce((a,p)=>a+p.length,0);
      setStat(`成分 ${s.T.length}／穴 ${s.holes.length}／頂点 ${nv}${nv>80?'（頂点が多いと計算が重くなります。単純化を強めてください）':''}`);
    } catch (e) { setStat('解析に失敗しました: ' + (e as Error).message); }
  }, [img, thresh, eps, minar, invert]); // eslint-disable-line

  useEffect(() => { refresh(); }, [img, thresh, eps, minar, invert]); // eslint-disable-line

  function loadFile(file: File) {
    if (!file || !/^image\//.test(file.type)) { setStat('画像ファイルを選んでください。'); return; }
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      const S = Math.max(im.width, im.height), sc = Math.min(1, 240/S);
      const w = Math.max(4, Math.round(im.width*sc)), h = Math.max(4, Math.round(im.height*sc));
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d', { willReadFrequently: true })!;
      ctx.fillStyle = '#fff'; ctx.fillRect(0,0,w,h); ctx.drawImage(im,0,0,w,h);
      setImg({ data: ctx.getImageData(0,0,w,h).data, w, h });
      URL.revokeObjectURL(url);
    };
    im.onerror = () => { setStat('画像を読み込めませんでした。'); URL.revokeObjectURL(url); };
    im.src = url;
  }

  const polyPath = shape?.T.length
    ? [...shape.T, ...shape.holes].map(R => 'M' + R.map(p => `${p[0].toFixed(4)} ${(1-p[1]).toFixed(4)}`).join('L') + 'Z').join('')
    : '';

  return (
    <div>
      <label
        className={`drop${isDrop ? ' over' : ''}`}
        id="drop"
        htmlFor="imgfile"
        onDragEnter={e => { e.preventDefault(); setIsDrop(true); }}
        onDragOver={e => { e.preventDefault(); setIsDrop(true); }}
        onDragLeave={e => { e.preventDefault(); setIsDrop(false); }}
        onDrop={e => {
          e.preventDefault(); setIsDrop(false);
          const f = e.dataTransfer?.files?.[0]; if (f) loadFile(f);
        }}
      >
        画像をドロップ、またはクリックして選択
        <input type="file" id="imgfile" accept="image/*" onChange={e => {
          const f = e.target.files?.[0]; if (f) loadFile(f);
        }} />
      </label>

      {img && (
        <div id="imgctl">
          <div className="slider" style={{ marginTop: '8px' }}>
            <span>しきい値</span>
            <input type="range" min={1} max={254} value={thresh} onChange={e => setThresh(+e.target.value)} />
            <b>{thresh}</b>
          </div>
          <div className="slider">
            <span>単純化</span>
            <input type="range" min={2} max={60} value={eps} onChange={e => setEps(+e.target.value)} />
            <b>{(eps/10).toFixed(1)} px</b>
          </div>
          <div className="slider">
            <span>最小面積</span>
            <input type="range" min={1} max={100} value={minar} onChange={e => setMinar(+e.target.value)} />
            <b>{(minar/100).toFixed(2)} %</b>
          </div>
          <div className="row">
            <label><input type="checkbox" checked={invert} onChange={e => setInvert(e.target.checked)} /> 明暗を反転</label>
          </div>
          <div className="imgprev">
            <canvas ref={canvasRef} />
            <svg ref={svgRef} viewBox="0 0 100 100">
              {polyPath && <path d={polyPath} fill="#2E5A87" fillOpacity={0.6} fillRule="evenodd" stroke="#2E5A87" strokeWidth={0.5} transform="scale(100)" />}
            </svg>
          </div>
          <p className="hint">{stat}</p>
          <div className="row">
            <button
              type="button" className="primary" style={{ width: '100%' }}
              disabled={!shape?.T.length}
              onClick={() => { if (shape?.T.length) onUse({ name: 'image', T: shape.T, holes: shape.holes }); }}
            >この形を使う</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageTab;
