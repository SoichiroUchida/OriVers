import { useState, type FC } from 'react';
import type { Shape, InputTab } from '../../types';
import PresetTab from './PresetTab';
import EditorTab from './EditorTab';
import ImageTab from './ImageTab';

interface Props {
  shape: Shape;
  onSetShape: (shape: Shape) => void;
}

const ShapeInput: FC<Props> = ({ shape, onSetShape }) => {
  const [tab, setTab] = useState<InputTab>('preset');

  return (
    <div className="card">
      <h2>入力図形 T</h2>
      <div className="tabs" role="tablist">
        {(['preset', 'editor', 'image'] as InputTab[]).map(t => (
          <button
            key={t}
            type="button"
            className={tab === t ? 'on' : ''}
            onClick={() => setTab(t)}
          >
            {t === 'preset' ? 'プリセット' : t === 'editor' ? 'エディタ' : '画像'}
          </button>
        ))}
      </div>
      {tab === 'preset' && <PresetTab current={shape.name} onSelect={onSetShape} />}
      {tab === 'editor' && <EditorTab currentShape={shape} onUse={onSetShape} />}
      {tab === 'image' && <ImageTab onUse={onSetShape} />}
    </div>
  );
};

export default ShapeInput;
