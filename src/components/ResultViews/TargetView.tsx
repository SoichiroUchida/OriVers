import type { FC } from 'react';
import type { Shape } from '../../types';
import { SHAPE_NAMES } from '../../data/shapes';
import { cssVar } from '../../hooks/useCssVar';

interface Props { shape: Shape }

function pathOf(rings: number[][][], tf: (p: number[]) => number[]): string {
  return rings.map(R => 'M' + R.map(p => { const q = tf(p); return q[0].toFixed(5) + ' ' + q[1].toFixed(5); }).join('L') + 'Z').join('');
}

const TargetView: FC<Props> = ({ shape }) => {
  const tf = (p: number[]) => [p[0]*0.9+0.05, 1-(p[1]*0.9+0.05)];
  const grid = cssVar('--grid');
  const line = cssVar('--line');
  const nv = shape.T.reduce((s,r)=>s+r.length,0) + shape.holes.reduce((s,r)=>s+r.length,0);
  const gridLines: { x1:number;y1:number;x2:number;y2:number }[] = [];
  for (let k = 0; k <= 10; k++) {
    const t = 0.05 + 0.09*k;
    gridLines.push({ x1:0.05,y1:t,x2:0.95,y2:t });
    gridLines.push({ x1:t,y1:0.05,x2:t,y2:0.95 });
  }

  return (
    <section className="view">
      <h3>(a) 目標図形 <i>T</i></h3>
      <p className="cap">
        {SHAPE_NAMES[shape.name]||shape.name}：成分 {shape.T.length}・穴 {shape.holes.length}・頂点 {nv}。[0,1]² 上の多角形。
      </p>
      <svg viewBox="0 0 1 1">
        {gridLines.map((l,i) => (
          <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={grid} strokeWidth={0.002} />
        ))}
        <rect x={0.05} y={0.05} width={0.9} height={0.9} fill="none" stroke={line} strokeWidth={0.003} />
        <path
          d={pathOf([...shape.T, ...shape.holes], tf)}
          fill="#2E5A87" fillOpacity={0.85} fillRule="evenodd"
          stroke="#2E5A87" strokeWidth={0.004} strokeLinejoin="round"
        />
      </svg>
    </section>
  );
};

export default TargetView;
