import type { FC } from 'react';

interface Props {
  onToggleTheme: () => void;
}

const Header: FC<Props> = ({ onToggleTheme }) => (
  <header>
    <h1>OriVers</h1>
    <span className="sub">
      紙の縁で <i>T</i> の輪郭をなぞり、<i>T</i> の上だけに<b>裏面（色）</b>を出し、<i>T</i>{' '}
      の外には色を一切出さない折り方を、境界一致の折線 ＋ 袋モデルの厳密な層順序（SAT）で求めます
    </span>
    <button type="button" onClick={onToggleTheme}>テーマ</button>
  </header>
);

export default Header;
