import { useState, type FC } from 'react';
import type { DKResult, Shape } from '../types';

interface Props {
  result: DKResult | null;
  shape: Shape;
}

function fitBox(pts: number[][], pad: number) {
  let a=Infinity,b=Infinity,c=-Infinity,d=-Infinity;
  for (const p of pts) { a=Math.min(a,p[0]);b=Math.min(b,p[1]);c=Math.max(c,p[0]);d=Math.max(d,p[1]); }
  const s=Math.max(c-a,d-b)*(1+2*pad),cx=(a+c)/2,cy=(b+d)/2;
  return { x0:cx-s/2, y0:cy-s/2, s, tf:(p:number[])=>[(p[0]-(cx-s/2))/s, 1-(p[1]-(cy-s/2))/s] };
}

function download(txt: string, name: string, mime: string) {
  const blob = new Blob([txt], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

const ExportPanel: FC<Props> = ({ result, shape }) => {
  const [sheetMM, setSheetMM] = useState(150);
  const ok = !!(result);

  function baseName() { return `orivers_${result?.shapeName || 'shape'}_${result?.paperKind}`; }

  function paperFrame(scale: number) {
    const P = result!.cand.paper;
    let a=Infinity,b=Infinity,c=-Infinity,d=-Infinity;
    for (const p of P) { a=Math.min(a,p[0]);b=Math.min(b,p[1]);c=Math.max(c,p[0]);d=Math.max(d,p[1]); }
    const k = scale / Math.max(c-a, d-b);
    return { w:(c-a)*k, h:(d-b)*k, tf:(p:number[])=>[(p[0]-a)*k,(d-p[1])*k], k };
  }

  function exportCPSVG() {
    const S = sheetMM, fr = paperFrame(S);
    const f = (x:number) => (+x).toFixed(6);
    const sw = (S/400).toFixed(4);
    const L = ['<?xml version="1.0" encoding="UTF-8"?>',
      `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${f(fr.w)}mm" height="${f(fr.h)}mm" viewBox="0 0 ${f(fr.w)} ${f(fr.h)}">`];
    const line = (A:number[], B:number[], col:string) => {
      const p=fr.tf(A),q=fr.tf(B);
      L.push(`<line x1="${f(p[0])}" y1="${f(p[1])}" x2="${f(q[0])}" y2="${f(q[1])}" stroke="${col}" stroke-width="${sw}"/>`);
    };
    const P = result!.cand.paper;
    for (let i=0;i<P.length;i++) line(P[i], P[(i+1)%P.length], 'rgb(0,0,0)');
    for (const c of result!.creases) line(c.a, c.b, c.mv==='M'?'rgb(255,0,0)':'rgb(0,0,255)');
    L.push('</svg>');
    download(L.join('\n')+'\n', baseName()+'_cp.svg', 'image/svg+xml');
  }

  function exportCP() {
    const fr = paperFrame(400), f = (x:number) => (+x).toFixed(6);
    const t = (p:number[]) => { const q=fr.tf(p); return [q[0]-fr.w/2, q[1]-fr.h/2]; };
    const out: string[] = [];
    const P = result!.cand.paper;
    const ln = (ty:number, A:number[], B:number[]) => { const p=t(A),q=t(B); out.push(`${ty} ${f(p[0])} ${f(p[1])} ${f(q[0])} ${f(q[1])}`); };
    for (let i=0;i<P.length;i++) ln(1, P[i], P[(i+1)%P.length]);
    for (const c of result!.creases) ln(c.mv==='M'?2:3, c.a, c.b);
    download(out.join('\n')+'\n', baseName()+'.cp', 'text/plain');
  }

  function exportFold() {
    const R = result!;
    const s = R.cand.faces.map(x => x.s);
    const pts: number[][] = [];
    for (const p of R.pieces) for (const q of p.poly) pts.push(q);
    const fb = fitBox(pts, 0.03), S = 800;
    const tf = (p:number[]) => { const q=fb.tf(p); return [q[0]*S, q[1]*S]; };
    const d = (rings:number[][][]) => rings.map(r => 'M'+r.map(p=>{const q=tf(p);return q[0].toFixed(3)+' '+q[1].toFixed(3);}).join(' L')+' Z').join(' ');
    const F = R.pieces.filter(p=>s[p.top]>0).map(p=>p.poly);
    const B = R.pieces.filter(p=>s[p.top]<0).map(p=>p.poly);
    const L = ['<?xml version="1.0" encoding="UTF-8"?>',
      `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">`,
      `<desc>OriVers folded state</desc>`,
      `<path d="${d(F)}" fill="#F4EBDD" stroke="#F4EBDD" stroke-width="0.6" stroke-linejoin="round"/>`,
      `<path d="${d(B)}" fill="#2E5A87" stroke="#2E5A87" stroke-width="0.6" stroke-linejoin="round"/>`,
      `<path d="${d([...shape.T,...shape.holes])}" fill="none" stroke="#c9873a" stroke-width="2.5" stroke-dasharray="9 6"/>`,
      '</svg>'];
    download(L.join('\n')+'\n', baseName()+'_folded.svg', 'image/svg+xml');
  }

  function exportJSON() {
    const R = result!, n = R.n;
    const above: [number,number][] = [];
    for (const [i,j] of R.ovPairs) above.push(R.P[i*n+j] ? [i,j] : [j,i]);
    const cells = new Map<string, { stack: number[]; inT: boolean }>();
    for (const p of R.pieces) {
      if (p.tiny) continue;
      const k = p.cov.join(',');
      if (cells.has(k)) continue;
      const st = [...p.cov].sort((x,y) =>
        p.cov.reduce((t,g)=>t+R.P[y*n+g],0) - p.cov.reduce((t,g)=>t+R.P[x*n+g],0)
      );
      cells.set(k, { stack: st, inT: !!p.inT });
    }
    const out = {
      format: 'orivers-layer-1',
      shape: R.shapeName, paperKind: R.paperKind, W: R.W,
      paper: R.cand.paper, T: shape.T, holes: shape.holes,
      candidate: { index: R.cand.index, phase: R.cand.phase, seed: R.cand.seed, tried: R.tried },
      faces: R.cand.faces,
      above_pairs: above,
      note: 'above_pairs[k]=[i,j]: face i lies above face j',
      P: Array.from(R.P), cells: [...cells.values()],
      creases: R.creases.map(c => ({ a: c.a, b: c.b, mv: c.mv, faces: [c.f0, c.f1] })),
      stats: { ...R.info, check: R.check, maekawa: { interior: R.maekawa.interior, bad: R.maekawa.bad }, violated: R.violated, ms: R.ms },
    };
    download(JSON.stringify(out), baseName()+'.json', 'application/json');
  }

  return (
    <div className="card">
      <h2>書き出し</h2>
      <div className="row">
        <label htmlFor="sheet">用紙サイズ</label>
        <input type="number" id="sheet" value={sheetMM} min={10} max={2000} step={5}
          style={{ width: '80px' }} onChange={e => setSheetMM(+e.target.value)} />
        <span className="hint" style={{ margin: 0 }}>mm（SVG）／ .cp は一辺 400</span>
      </div>
      <div className="exports">
        <button type="button" disabled={!ok} onClick={exportCPSVG}>展開図 .svg</button>
        <button type="button" disabled={!ok} onClick={exportCP}>展開図 .cp</button>
        <button type="button" disabled={!ok} onClick={exportFold}>完成形 .svg</button>
        <button type="button" disabled={!ok} onClick={exportJSON}>層順序 .json</button>
      </div>
      <p className="hint">展開図 SVG は ORIPA / Oriedita 互換（線のみ・輪郭 rgb(0,0,0)・山 rgb(255,0,0)・谷 rgb(0,0,255)）。</p>
    </div>
  );
};

export default ExportPanel;
