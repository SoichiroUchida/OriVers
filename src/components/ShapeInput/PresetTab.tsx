import type { FC } from 'react';
import { SHAPES, SHAPE_NAMES } from '../../data/shapes';
import type { Shape } from '../../types';

interface Props {
  current: string;
  onSelect: (shape: Shape) => void;
}

function pathOf(rings: number[][][], tf: (p: number[]) => number[]): string {
  return rings.map(R => 'M' + R.map(p => { const q = tf(p); return q[0].toFixed(5) + ' ' + q[1].toFixed(5); }).join('L') + 'Z').join('');
}

const PresetTab: FC<Props> = ({ current, onSelect }) => (
  <div className="presets">
    {SHAPES.map(sh => {
      const tf = (p: number[]) => [p[0], 1 - p[1]];
      const d = pathOf([...sh.T, ...sh.holes], tf);
      return (
        <button
          key={sh.name}
          type="button"
          title={sh.name}
          className={current === sh.name ? 'on' : ''}
          onClick={() => onSelect(sh)}
        >
          <svg viewBox="-0.05 -0.05 1.1 1.1">
            <rect x={0} y={0} width={1} height={1} fill="none" stroke="currentColor" strokeWidth={0.03} opacity={0.35} />
            <path d={d} fill="currentColor" fillRule="evenodd" opacity={0.8} />
          </svg>
          <span>{SHAPE_NAMES[sh.name] || sh.name}</span>
        </button>
      );
    })}
  </div>
);

export default PresetTab;
