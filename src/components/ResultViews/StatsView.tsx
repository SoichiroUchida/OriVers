import type { FC } from 'react';
import type { DKResult, DKFailResult } from '../../types';

interface Props {
  result: DKResult | DKFailResult | null;
  running: boolean;
}

const StatsView: FC<Props> = ({ result, running }) => {
  const rows: { k: string; v: string; cls?: string }[] = [];
  let verdict: { good: boolean; text: string } | null = null;

  if (running) {
    rows.push({ k: '状態', v: '計算中…（左の進捗を参照）' });
  } else if (!result) {
    rows.push({ k: '状態', v: '「計算する」を押してください' });
  } else if (!result.ok) {
    rows.push({ k: '状態', v: `失敗：${result.tried} 個の候補すべてで層順序が存在しません（UNSAT）`, cls: 'bad' });
  } else {
    const R = result as DKResult;
    const C = R.check, MK = R.maekawa, I = R.info;
    const nFold = R.creases.length, nM = R.creases.filter(c => c.mv === 'M').length;
    rows.push({ k: '紙の一辺 W', v: R.W.toFixed(5) });
    rows.push({ k: '面（三角形）', v: String(R.n) });
    rows.push({ k: '折線（山／谷）', v: `${nFold}（${nM}／${nFold-nM}）` });
    rows.push({ k: '試した候補', v: `${R.tried}（採用 #${R.cand.index}、φ=${R.cand.phase}, seed=${R.cand.seed}）` });
    rows.push({ k: 'SAT 変数／節', v: `${I.vars.toLocaleString()}／${I.clauses.toLocaleString()}` });
    rows.push({ k: '内訳', v: `推移律 ${I.triples} 組・taco–taco ${I.taco_taco}・taco–tortilla ${I.taco_tortilla}` });
    if (R.capInfo) rows.push({ k: '袋モデル', v: `輪郭の辺 ${R.capInfo.dAtoms}・ジップ対 ${R.capInfo.zips}・強キャップ単位節 ${R.nStrong}` });
    rows.push({ k: 'セル（被覆集合）', v: `${I.cells}（凸片 ${I.pieces}）` });
    rows.push({ k: '最大層数', v: String(C.max_layers) });
    const back = C.back_on_top;
    rows.push({ k: 'T 上で裏面が最上層', v: (back*100).toFixed(4)+' %', cls: back >= 1-1e-12 ? 'ok' : 'bad' });
    rows.push({ k: 'T の被覆', v: `${(C.T_area_cells/C.T_area*100).toFixed(4)} %`, cls: Math.abs(C.T_area_cells/C.T_area-1)<1e-6 ? 'ok' : 'bad' });
    rows.push({ k: 'T の外の色の面積', v: (C.back_out||0).toExponential(2)+`（外の白い紙 ${(C.out_area||0).toFixed(4)}）`, cls: (C.back_out||0)===0 ? 'ok' : 'bad' });
    rows.push({ k: '全順序でないセル', v: String(C.not_total), cls: C.not_total===0 ? 'ok' : 'bad' });
    rows.push({ k: '違反節（解の再評価）', v: String(R.violated), cls: R.violated===0 ? 'ok' : 'bad' });
    rows.push({ k: '前川 |M−V|=2（内部頂点）', v: `${MK.interior-MK.bad}／${MK.interior}`, cls: MK.bad===0 ? 'ok' : 'bad' });
    const last = R.log[R.log.length-1];
    rows.push({ k: '計算時間', v: `${Math.round(R.ms)} ms（最終候補: 構築 ${last ? Math.round(last.ms_build||0) : 0} ms）` });
    const good = back >= 1-1e-12 && C.not_total===0 && R.violated===0 && MK.bad===0 && !(C.back_out>0);
    verdict = { good, text: good
      ? '✓ インサイドアウト実現：Justin の条件と袋モデルを満たす層順序が存在します。T 全体で裏面が最上層、T の外に色は出ず、輪郭は紙の生の縁です。'
      : '要確認：上の赤字の項目を確認してください。' };
  }

  return (
    <section className="view dkview">
      <h3>(d) 統計と検証</h3>
      <table className="stats">
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{r.k}</td>
              <td className={r.cls}>{r.v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {verdict && (
        <div className={`verdict`}>
          <span className={verdict.good ? 'ok' : 'bad'}>{verdict.text}</span>
        </div>
      )}
    </section>
  );
};

export default StatsView;
