const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]];
const add=(a,b)=>[a[0]+b[0],a[1]+b[1]];
const mul=(a,s)=>[a[0]*s,a[1]*s];
const len=a=>Math.hypot(a[0],a[1]);
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];

function signedArea(V){let s=0;for(let i=0;i<V.length;i++){const a=V[i],b=V[(i+1)%V.length];s+=a[0]*b[1]-b[0]*a[1];}return s/2;}
function orient(V,ccw){const c=[...V.map(p=>[...p])];return (signedArea(c)>0)===ccw?c:c.reverse();}

function segInt(p1,p2,p3,p4){
  const d1=sub(p2,p1),d2=sub(p4,p3),den=cross(d1,d2);
  if(Math.abs(den)<1e-14)return null;
  const e=sub(p3,p1);
  return [cross(e,d2)/den, cross(e,d1)/den];
}
function pointInPoly(V,p){
  let inside=false;
  for(let i=0;i<V.length;i++){
    const a=V[i],b=V[(i+1)%V.length];
    if((a[1]>p[1])!==(b[1]>p[1])){
      const x=a[0]+(p[1]-a[1])/(b[1]-a[1]+1e-300)*(b[0]-a[0]);
      if(p[0]<x)inside=!inside;
    }
  }
  return inside;
}
function visible(V,p,q){
  for(let i=0;i<V.length;i++){
    const r=segInt(p,q,V[i],V[(i+1)%V.length]);
    if(!r)continue;
    const[t,s]=r;
    if(t>1e-7&&t<1-1e-7&&s>1e-7&&s<1-1e-7)return false;
  }
  return pointInPoly(V,[(p[0]+q[0])/2,(p[1]+q[1])/2]);
}
function interiorAngle(V,i){
  // CCW 多角形では内角は左側。atan2 の符号を反転させる必要がある。
  const n=V.length,a=V[(i-1+n)%n],b=V[i],c=V[(i+1)%n];
  const u=sub(a,b),v=sub(c,b);
  let th=-Math.atan2(cross(u,v),dot(u,v));
  if(th<0)th+=2*Math.PI;
  return th;
}
function angleAt(a,b,c){
  const u=sub(a,b),v=sub(c,b);
  return Math.acos(Math.max(-1,Math.min(1,dot(u,v)/(len(u)*len(v)))));
}

/* ============================================================
   (A) 境界割り当て
   ============================================================ */
function sameRegion(A,B){
  if(A.length!==B.length)return false;
  const ca=orient(A,true),cb=orient(B,true);
  for(let sh=0;sh<ca.length;sh++){
    let ok=true;
    for(let i=0;i<ca.length;i++)if(dist(ca[i],cb[(i+sh)%cb.length])>1e-9){ok=false;break;}
    if(ok)return true;
  }
  return false;
}
/* ---- ブリッジの配置 ----
   Q = Σℓ(∂T_i) + 2·(ブリッジ総長) であり第1項は入力で固定なので、
   Q の最小化はブリッジ総長の最小化と同値である。W は Q に比例し
   紙の面積は W² なので、ここでの削減は2乗で効く。

   方針は「非交差を最優先し、その中で最短」。橋が面積ゼロである以上
   交差しても命題 3.3 の巻き数計算は壊れないが、交差のない橋のほうが
   折線パターンが読みやすく実装も頑健になる。

   成分（各 T_i と各穴 H_j）をノード、境界間の最短距離を重みとする
   グラフ上で、Kruskal の順に「交差しない辺だけ」を採る。
   非交差制約は matroid でないので貪欲は最適性を保証しない。
   得られるのは「非交差を満たす木のうち短いもの」である。 */
function closestOnSeg(p,a,b){
  const ab=sub(b,a),L2=dot(ab,ab);
  if(L2<1e-300)return[...a];
  const t=Math.max(0,Math.min(1,dot(sub(p,a),ab)/L2));
  return add(a,mul(ab,t));
}
function boundaryClosest(A,B){
  let bd=Infinity,bp=null,bq=null;
  const scan=(P,Q,flip)=>{
    for(const p of P)for(let j=0;j<Q.length;j++){
      const q=closestOnSeg(p,Q[j],Q[(j+1)%Q.length]);
      const d=dist(p,q);
      if(d<bd){bd=d;if(flip){bp=q;bq=p;}else{bp=p;bq=q;}}
    }
  };
  scan(A,B,false);scan(B,A,true);
  return {d:bd,pa:bp,pb:bq};
}
/* 端点での接触は交差とみなさない */
function segCrossStrict(p1,p2,p3,p4){
  const r=segInt(p1,p2,p3,p4);
  if(!r)return false;
  const[t,s]=r;
  const e=1e-7;
  return t>e&&t<1-e&&s>e&&s<1-e;
}
function segCrossesPoly(a,b,V){
  for(let i=0;i<V.length;i++)
    if(segCrossStrict(a,b,V[i],V[(i+1)%V.length]))return true;
  return false;
}
let BRIDGE_MODE=0;
function setBridgeMode(m){BRIDGE_MODE=m;}
/* bridge endpoints in edge interiors, nearly perpendicular to both edges */
function bridgePerp(PA,PB){
  let best=null;
  const samples=P=>{const out=[];for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length];
    for(const u of [0.2,0.35,0.5,0.65,0.8]){out.push({p:add(a,mul(sub(b,a),u)),t:mul(sub(b,a),1/Math.max(1e-12,dist(a,b)))});}}return out;};
  const SA=samples(PA),SB=samples(PB);
  for(const x of SA)for(const y of SB){
    const v=sub(y.p,x.p),L=Math.hypot(v[0],v[1]);if(L<1e-9)continue;
    const ca=Math.abs(dot(v,x.t))/L,cb=Math.abs(dot(v,y.t))/L;   // cos of angle to edges (0 = perpendicular)
    const score=L*(1+2*(ca+cb));
    if(segCrossesPoly(x.p,y.p,PA)||segCrossesPoly(x.p,y.p,PB))continue;
    if(!best||score<best.s)best={s:score,d:L,pa:x.p,pb:y.p};
  }
  return best||boundaryClosest(PA,PB);
}
function planBridges(Ts,holes){
  const nodes=[];
  Ts.forEach((T,i)=>nodes.push({poly:orient(T,true),isHole:false,src:i,idx:nodes.length}));
  (holes||[]).forEach(H=>{
    const Hv=orient(H,true);
    // 穴は自分を含む T_i にだけつなぐ。∂T_i を横切るのは避けられないので
    // この辺だけは交差検査を免除する（横切りは親への1回に限られる）。
    let par=0;
    for(let i=0;i<Ts.length;i++)
      if(pointInPoly(orient(Ts[i],true),Hv[0])){par=i;break;}
    nodes.push({poly:Hv,isHole:true,parent:par,idx:nodes.length});
  });
  const k=nodes.length;
  if(k<=1)return {bridges:[],nodes,total:0,crossFree:true};

  const cands=[];
  for(let i=0;i<k;i++)for(let j=i+1;j<k;j++){
    const A=nodes[i],B=nodes[j];
    if(A.isHole&&B.isHole)continue;
    if(A.isHole&&A.parent!==B.src)continue;
    if(B.isHole&&B.parent!==A.src)continue;
    const c=(BRIDGE_MODE===0)?boundaryClosest(A.poly,B.poly):bridgePerp(A.poly,B.poly);
    cands.push({i,j,d:c.d,pa:c.pa,pb:c.pb,holeEdge:A.isHole||B.isHole});
  }
  cands.sort((x,y)=>x.d-y.d);

  const par=[...Array(k).keys()];
  const find=x=>par[x]===x?x:(par[x]=find(par[x]));
  const chosen=[];
  const acceptable=e=>{
    if(e.holeEdge)return true;
    for(const nd of nodes){
      if(nd.idx===e.i||nd.idx===e.j)continue;
      if(segCrossesPoly(e.pa,e.pb,nd.poly))return false;
    }
    // 端点を持つ成分自身の境界も貫通してはいけない
    for(const id of[e.i,e.j])
      if(segCrossesPoly(e.pa,e.pb,nodes[id].poly))return false;
    for(const c of chosen)
      if(segCrossStrict(e.pa,e.pb,c.pa,c.pb))return false;
    return true;
  };
  for(const e of cands){
    if(chosen.length===k-1)break;
    if(find(e.i)===find(e.j))continue;
    if(!acceptable(e))continue;
    par[find(e.i)]=find(e.j);chosen.push(e);
  }
  // 交差を避けたままでは連結できない場合に限り、制約を外して木を閉じる
  let crossFree=true;
  if(chosen.length<k-1){
    crossFree=false;
    for(const e of cands){
      if(chosen.length===k-1)break;
      if(find(e.i)===find(e.j))continue;
      par[find(e.i)]=find(e.j);chosen.push(e);
    }
  }
  return {bridges:chosen,nodes,total:chosen.reduce((s,c)=>s+c.d,0),crossFree};
}

function buildL0(M,Ts,holes){
  // 囲い（旧 ∂M）は用いない。∂T を時計回りに1周し、
  // 成分間・穴への出入りは面積ゼロのブリッジで結ぶ（一筆書き）。
  //   w = −1 (int T) / 0 (それ以外)
  // T 内で裏面が最上層に来ることは補題 3.2 から従う。
  // T 外は w = 0 のため層数が偶数となり、最上層の向きは確定しない。
  const plan=planBridges(Ts,holes);
  const {nodes,bridges}=plan;
  // 橋の木を深さ優先でたどる。各辺は往復するので巻き数への寄与は 0。
  const adj=nodes.map(()=>[]);
  bridges.forEach(b=>{adj[b.i].push(b);adj[b.j].push(b);});
  const seq=[];
  const seen=new Array(nodes.length).fill(false);
  // 境界上の点を「何番目の辺の、どれだけ進んだ位置か」で表す。
  // これで entry と枝の根元を周回の途中に正しく差し込める。
  const param=(Rv,p)=>{
    let bi=0,bt=Infinity,bu=0;
    for(let i=0;i<Rv.length;i++){
      const a=Rv[i],b=Rv[(i+1)%Rv.length];
      const ab=sub(b,a),L2=dot(ab,ab);
      const u=L2<1e-300?0:Math.max(0,Math.min(1,dot(sub(p,a),ab)/L2));
      const q=add(a,mul(ab,u));
      const d=dist(p,q);
      if(d<bt){bt=d;bi=i;bu=u;}
    }
    return bi+bu;
  };
  const walk=(id,entry)=>{
    seen[id]=true;
    const nd=nodes[id];
    const Rv=orient(nd.poly,nd.isHole);   // 穴: CCW / T: CW
    const n=Rv.length;
    const outs=adj[id].filter(b=>!seen[b.i===id?b.j:b.i]);
    outs.forEach(b=>{seen[b.i===id?b.j:b.i]=true;});
    // 周回の開始位置。親から入った点があればそこ、なければ頂点 0。
    const t0=entry?param(Rv,entry):0;
    // 枝の根元を開始位置からの相対弧長で並べ、周回の途中で順に出入りする
    const stops=outs.map(b=>{
      const myPt=b.i===id?b.pa:b.pb;
      let t=param(Rv,myPt)-t0;
      if(t<0)t+=n;
      return {t,b,myPt,hisPt:b.i===id?b.pb:b.pa,other:b.i===id?b.j:b.i};
    }).sort((x,y)=>x.t-y.t);

    const at=t=>{
      const i=Math.floor(t)%n, u=t-Math.floor(t);
      return add(Rv[i],mul(sub(Rv[(i+1)%n],Rv[i]),u));
    };
    let cur=0;                    // 開始位置からの進み（0 <= cur <= n）
    seq.push(at(t0));
    const advance=to=>{
      // cur から to まで、途中の頂点をすべて拾いながら進む
      let k=Math.floor(t0+cur)+1;
      while(k<t0+to-1e-12){seq.push(at(k));k++;}
      seq.push(at(t0+to));
      cur=to;
    };
    for(const s of stops){
      advance(s.t);               // 根元まで境界に沿って進む
      seq.push([...s.hisPt]);     // 往路
      walk(s.other,s.hisPt);
      seq.push([...s.hisPt]);     // 復路（根元へ戻る）
      seq.push(at(t0+s.t));
    }
    advance(n);                   // 周回を閉じる
  };
  walk(0,null);
  // 連続する重複点を除く
  const out=[];
  for(const p of seq)if(!out.length||dist(p,out[out.length-1])>1e-12)out.push(p);
  if(out.length>1&&dist(out[0],out[out.length-1])<1e-12)out.pop();
  out.bridgePlan=plan;
  return out;
}
function cumulative(P){
  const c=[0];
  for(let i=0;i<P.length;i++)c.push(c[c.length-1]+dist(P[i],P[(i+1)%P.length]));
  return c;
}
/* スパーを折れ線にして弧長 r を稼ぐ。
   直線では他と交差してしまう場合に使う。
   基点から出発し、進める方向へ進めるだけ進む、を繰り返す。
   往路の点列を返す（復路は呼び出し側で逆順に積む）。 */
function foldSpur(bp,prefDir,r,base,placed){
  const clearDist=(from,dir,limit)=>{
    /* from から dir 方向へ、何か（base の辺・既に置いたスパーの各区間）に
       当たるまでの距離。placed には折れ線の区間がすべて入っているので、
       後から立てるスパーが先のものを突き抜けることはない。 */
    const far=add(from,mul(dir,limit));
    let best=limit;
    const scan=(p,q)=>{
      if(dist(p,q)<1e-12)return;
      // 始点を共有する辺との接触は許す（そこから伸びるので）
      if(dist(p,from)<1e-9||dist(q,from)<1e-9)return;
      const s=segInt(from,far,p,q);
      if(!s)return;
      const[t1,t2]=s;
      if(t1>1e-9&&t1<=1&&t2>-1e-9&&t2<1+1e-9)best=Math.min(best,t1*limit);
    };
    for(let k=0;k<base.length;k++)scan(base[k],base[(k+1)%base.length]);
    for(const sp of placed)scan(sp.bp,sp.tip);
    return best;
  };
  const path=[[...bp]];
  let cur=[...bp], remain=r, dir=[...prefDir];
  const EPSR=1e-12*Math.max(1,r);
  let guard=0;
  while(remain>EPSR&&guard++<400){
    // 現在の向きを基準に、進める距離が最大の方向を探す
    let bestD=null,bestLen=0;
    const th0=Math.atan2(dir[1],dir[0]);
    for(let k=0;k<=36&&bestLen<remain-EPSR;k++)for(const sgn of (k===0?[1]:[1,-1])){
      const th=th0+sgn*k*(Math.PI/36);
      const cand=[Math.cos(th),Math.sin(th)];
      const room=clearDist(cur,cand,remain)*0.98;
      if(room>bestLen){bestLen=room;bestD=cand;}
      if(bestLen>=remain-EPSR)break;
    }
    if(!bestD||bestLen<=EPSR){
      // どの向きにも進めない。ここまでの経路を細かく往復して弧長を稼ぐ。
      // 往復は面積ゼロなので巻き数を変えず、弧長 r だけを正しく消費できる。
      const back=path.length>1?path[path.length-2]:null;
      if(back){
        const seg=dist(cur,back);
        while(remain>EPSR){
          const step=Math.min(remain,seg*0.5);
          const u2=mul(sub(back,cur),step/seg);
          path.push(add(cur,u2));
          remain-=step;
          if(remain<=EPSR)break;
          const step2=Math.min(remain,step);
          path.push(add(add(cur,u2),mul(sub(cur,back),step2/seg)));
          remain-=step2;
        }
      }else{
        // 戻る先すらないときは最後の向きへ伸ばす（交差しうるが弧長は守る）
        cur=add(cur,mul(dir,remain));
        path.push([...cur]);
        remain=0;
      }
      break;
    }
    const step=Math.min(remain,bestLen);
    cur=add(cur,mul(bestD,step));
    path.push([...cur]);
    remain-=step;
    dir=bestD;
  }
  if(remain>EPSR){               // 保険：弧長 r を必ず使い切る
    cur=add(cur,mul(dir,remain));
    path.push([...cur]);
  }
  return path;
}

/* スパーを T の内部だけを通る折れ線にする。
   r が T の内接円半径を超えると直線では収まらないので、
   T の中を這わせて弧長 r を稼ぐ。
   往復するので面積ゼロは保たれ、完全折り返し点の性質も変わらない。 */
function foldSpurInside(bp,prefDir,r,BASE,placed,Ts,Hs){
  const inT=p=>{
    let ins=false;
    for(const P of Ts)if(pointInPoly(P,p)){ins=true;break;}
    if(!ins)return false;
    for(const P of (Hs||[]))if(pointInPoly(P,p))return false;
    return true;
  };
  // bp からその向きへ、T の内部に留まったまま進める距離
  const room=(from,dir,limit)=>{
    let lo=0,hi=limit;
    if(!inT(add(from,mul(dir,Math.min(limit,1e-6)*1.0))))return 0;
    for(let i=0;i<40;i++){
      const mid=(lo+hi)/2;
      if(inT(add(from,mul(dir,mid))))lo=mid;else hi=mid;
    }
    /* T の内部に留まるだけでなく、∂T・橋・既に置いたスパーの
       どれとも交差しないことを確かめる。ここを省くと L が自己交差する。 */
    const tip=add(from,mul(dir,lo));
    const hits=(p,q)=>{
      if(dist(p,q)<1e-12)return false;
      if(dist(p,from)<1e-9||dist(q,from)<1e-9)return false;
      const s=segInt(from,tip,p,q);
      if(!s)return false;
      const[t1,t2]=s;
      return t1>1e-7&&t1<1-1e-7&&t2>1e-7&&t2<1-1e-7;
    };
    for(let k=0;k<BASE.length;k++)
      if(hits(BASE[k],BASE[(k+1)%BASE.length]))return 0;
    for(const sp of placed)if(hits(sp.bp,sp.tip))return 0;
    return lo;
  };
  const path=[[...bp]];
  let cur=[...bp], remain=r, dir=[...prefDir];
  const EPSR=1e-12*Math.max(1,r);
  let guard=0;
  while(remain>EPSR&&guard++<200){
    let bestD=null,bestLen=0;
    const th0=Math.atan2(dir[1],dir[0]);
    for(let k=0;k<=36&&bestLen<remain-EPSR;k++)for(const sgn of (k===0?[1]:[1,-1])){
      const th=th0+sgn*k*(Math.PI/36);
      const cand=[Math.cos(th),Math.sin(th)];
      const rr=room(cur,cand,remain)*0.98;
      if(rr>bestLen){bestLen=rr;bestD=cand;}
      if(bestLen>=remain-EPSR)break;
    }
    if(!bestD||bestLen<=EPSR)return null;    // T 内を這えない
    const step=Math.min(remain,bestLen);
    cur=add(cur,mul(bestD,step));
    path.push([...cur]);
    remain-=step;
    dir=bestD;
  }
  if(remain>EPSR)return null;
  /* 出来上がった経路が、base の辺・既存スパー・自分自身と
     交差していないか最終確認する。room() は各段階でしか見ておらず、
     後から引いた区間が前の区間を跨ぐことがある。 */
  const crosses=(p1,p2,p3,p4)=>{
    if(dist(p1,p2)<1e-12||dist(p3,p4)<1e-12)return false;
    const s=segInt(p1,p2,p3,p4);
    if(!s)return false;
    const[t1,t2]=s;
    return t1>1e-7&&t1<1-1e-7&&t2>1e-7&&t2<1-1e-7;
  };
  for(let z=0;z+1<path.length;z++){
    const a=path[z],b=path[z+1];
    for(let k=0;k<BASE.length;k++)
      if(crosses(a,b,BASE[k],BASE[(k+1)%BASE.length]))return null;
    for(const sp of placed)if(crosses(a,b,sp.bp,sp.tip))return null;
    for(let w=z+2;w+1<path.length;w++)
      if(crosses(a,b,path[w],path[w+1]))return null;
  }
  return path;
}

function addSpurs(L0,W,hull,phase,Ts,Hs){
  const base=L0.map(p=>[...p]);
  hull=hull||orient(L0,true);
  const cum=cumulative(base),Q=cum[cum.length-1];
  const r=W/2-Q/8;
  if(r<0)return null;
  /* 4基点は弧長 Q/4 ごとに置くが、開始位置（phase）は自由に選べる。
     ここを動かすと像の形が変わり、層順序が取れる配置と取れない配置がある。
     実測で、取れない配置でも phase をずらすと 8 通り中 6 通りで取れた。 */
  const ph=((phase||0)%Q+Q)%Q;
  const targets=[0,1,2,3].map(k=>(ph+k*Q/4)%Q);
  targets.sort((a,b)=>a-b);
  const pts=[];let acc=0,ti=0;
  const placed=[];               // 既に立てたスパー {bp,tip}
  const tipArc=[];               // スパー先端の弧長（L 上）
  let run=0;                     // これまでに積んだ pts の総弧長
  for(let i=0;i<base.length;i++){
    const a=base[i],b=base[(i+1)%base.length],e=dist(a,b);
    if(e<1e-12)continue;
    const u=mul(sub(b,a),1/e);
    let cur=[...a];const st=acc;
    // 基点が頂点に一致するとき取りこぼさないよう、末端を含めて判定する
    while(ti<4&&st-1e-9<=targets[ti]&&targets[ti]<st+e-1e-9){
      const bp=add(a,mul(u,targets[ti]-st));
      if(dist(bp,cur)>1e-12){pts.push([...cur]);}
      // cur -> bp 分の弧長を累積
      run+=dist(cur,bp);
      pts.push([...bp]);
      /* スパーの向き。
         法線の内側に決め打ちすると、r が長いとき他の ∂T や橋を突き抜ける。
         実測でランダム形状の 94% で像 L が自己交差していた（全てスパー起因）。
         そこで全方向を走査し、L0 のどの辺とも交差しない向きを選ぶ。
         内向きを優先するのは diam(L) を抑えるため（外向きは W を押し上げる）。 */
      const dirOK=(dd)=>{
        const tip=add(bp,mul(dd,r));
        const hits=(p,q)=>{
          if(dist(p,q)<1e-12)return false;
          if(dist(p,bp)<1e-9||dist(q,bp)<1e-9)return false;   // 基点での接触は許す
          const s=segInt(bp,tip,p,q);
          if(!s)return false;
          const[t1,t2]=s;
          return t1>1e-7&&t1<1-1e-7&&t2>1e-7&&t2<1-1e-7;
        };
        for(let k=0;k<base.length;k++)
          if(hits(base[k],base[(k+1)%base.length]))return false;
        // 既に立てたスパーとも交差しないこと（1本ずつ決めると後で衝突する）
        for(const sp of placed)if(hits(sp.bp,sp.tip))return false;
        return true;
      };
      const nIn=[-u[1],u[0]], nOut=[u[1],-u[0]];
      const inward=pointInPoly(hull,add(bp,mul(nIn,1e-6)))?nIn:nOut;
      const outward=(inward===nIn)?nOut:nIn;
      /* 向きの選択。
         (a) 他と交差しないこと（必須）
         (b) 先端が T の内部に留まること（優先）
         (b) を満たすと、その近傍の面も T の中に収まりやすい。
         「紙全体が T に対して同じ側に来る」ようにするための条件である。 */
      const tipInT=dd=>{
        if(!Ts||!Ts.length)return true;
        const tip=add(bp,mul(dd,r*0.999));
        let ins=false;
        for(const P of Ts)if(pointInPoly(P,tip)){ins=true;break;}
        if(!ins)return false;
        for(const P of (Hs||[]))if(pointInPoly(P,tip))return false;
        return true;
      };
      let d=null;
      // 1. 交差せず、かつ先端が T 内
      for(const cand of [inward,outward])if(dirOK(cand)&&tipInT(cand)){d=cand;break;}
      if(!d){
        const b0=Math.atan2(inward[1],inward[0]);
        for(let step=1;step<=72&&!d;step++)
          for(const sgn of [1,-1]){
            const th=b0+sgn*step*(Math.PI/72);
            const cand=[Math.cos(th),Math.sin(th)];
            if(dirOK(cand)&&tipInT(cand)){d=cand;break;}
          }
      }
      /* 2. 直線では T 内に収まらない場合。
         r が T の内接円半径を超えると（細長い T で起きる）
         どの向きへ伸ばしても T から出てしまう。
         そのときはスパーを折れ線にして T の内部を這わせる。
         往復である限り面積ゼロは保たれ、弧長 r も変わらない。 */
      let foldPath=null;
      if(!d&&Ts&&Ts.length){
        foldPath=foldSpurInside(bp,inward,r,base,placed,Ts,Hs);
        if(!foldPath)foldPath=null;
      }
      if(!d&&!foldPath)for(const cand of [inward,outward])if(dirOK(cand)){d=cand;break;}
      if(!d&&!foldPath){
        const base0=Math.atan2(inward[1],inward[0]);
        for(let step=1;step<=72&&!d;step++){
          for(const sgn of [1,-1]){
            const th=base0+sgn*step*(Math.PI/72);
            const cand=[Math.cos(th),Math.sin(th)];
            if(dirOK(cand)){d=cand;break;}
          }
        }
      }
      /* 3. 直線ではどの向きも塞がっているとき、スパーを折れ線にする。
         r が定理の下限 r = (√2-1)W/2 に達すると直線では収まらない。
         往路と復路が同じ経路をたどる限り面積ゼロは保たれ、
         弧長 r の往復という性質（完全折り返し点）も変わらないので、
         定理 4.9 の仮定は満たされたままである。 */
      const path=foldPath?foldPath:
                 (d?[bp,add(bp,mul(d,r))]:foldSpur(bp,inward,r,base,placed));
      const tipPt=path[path.length-1];
      // 折れ線の各区間を交差判定の対象に加える
      for(let z=0;z+1<path.length;z++)
        placed.push({bp:[...path[z]],tip:[...path[z+1]]});
      for(let z=1;z<path.length;z++)pts.push([...path[z]]);
      tipArc.push(run+r);        // bp から弧長 r 進んだところが先端
      for(let z=path.length-2;z>=0;z--)pts.push([...path[z]]);
      run+=2*r;                  // 往復分
      cur=[...bp];ti++;
    }
    if(dist(cur,b)>1e-12)run+=dist(cur,b);
    pts.push([...cur]);acc+=e;
  }
  const out=[];
  for(const p of pts)if(!out.length||dist(p,out[out.length-1])>1e-12)out.push(p);
  return {pts:out,Q,r,tipArc};
}
/* 像 L の自己交差を数える（接触は許し、真の横断のみ）。
   L が単純でなければ、そもそも紙を蛇腹に畳めない。
   スパーの向きを交差しないように選んでいるので通常は 0 になる。 */
function countLCrossings(L){
  const segs=[];
  for(let i=0;i<L.length;i++){
    const a=L[i],b=L[(i+1)%L.length];
    if(dist(a,b)>1e-12)segs.push([a,b]);
  }
  let x=0;
  for(let i=0;i<segs.length;i++)for(let j=i+1;j<segs.length;j++){
    const r=segInt(segs[i][0],segs[i][1],segs[j][0],segs[j][1]);
    if(!r)continue;
    const[t,s]=r;
    if(t>1e-7&&t<1-1e-7&&s>1e-7&&s<1-1e-7)x++;
  }
  return x;
}
function gP(t,W){
  t=((t%(4*W))+4*W)%(4*W);
  if(t<=W)return[t,0];
  if(t<=2*W)return[W,t-W];
  if(t<=3*W)return[3*W-t,W];
  return[0,4*W-t];
}
function reversalTips(P){
  const tips=[];let acc=0;
  for(let i=0;i<P.length;i++){
    const v1=sub(P[i],P[(i-1+P.length)%P.length]),v2=sub(P[(i+1)%P.length],P[i]);
    if(len(v1)>1e-12&&len(v2)>1e-12){
      const c=dot(v1,v2)/(len(v1)*len(v2));
      if(c<-0.999)tips.push(acc);
    }
    acc+=dist(P[i],P[(i+1)%P.length]);
  }
  return tips;
}
const CCONST=8-4*Math.SQRT2;

function boundaryAssignment(M,Ts,holes,phase){
  const L0=buildL0(M,Ts,holes);
  const cum0=cumulative(L0),Q0=cum0[cum0.length-1];
  let D=0;for(const a of L0)for(const b of L0)D=Math.max(D,dist(a,b));
  // 囲いを廃したので W_min(M) は下界に入らない。diam(L) と Q/(8−4√2) のみ。
  let W=Math.max(D,Q0/CCONST);
  // 囲いを廃したので、スパーの向きは L0 自身の向きで判定する。
  const hullM=orient(L0,true);
  /* W は陰に定まる（r が W に依存し、r が伸びると diam(L) が増えて W を押し上げる）。
     収束するまで反復するが、最後に必ず「確定した W」で作り直す。
     ここで作り直さないと res が古い W のもので、r = W/2 - Q/8 が崩れて
     L の全長が 4W からずれ、単位速度性が壊れる。 */
  let res=null;
  for(let it=0;it<70;it++){
    res=addSpurs(L0,W,hullM,phase,Ts,holes);
    if(!res){W*=1.05;continue;}
    let DL=0;for(const a of res.pts)for(const b of res.pts)DL=Math.max(DL,dist(a,b));
    if(DL<=W*(1+1e-12))break;
    W=DL;
    res=null;                    // この W ではまだ作っていない
  }
  if(!res)res=addSpurs(L0,W,hullM,phase,Ts,holes);
  if(!res)return null;
  const P=res.pts,cumP=cumulative(P);
  // 先端は addSpurs が記録した値を使う。
  // （基点が T の頂点と重なると reversalTips が拾えない）
  let tips=(res.tipArc&&res.tipArc.length===4)?res.tipArc.slice():reversalTips(P);
  const off=tips.length?tips[0]:0;
  const total=4*W;
  // 折り点集合 V(P) は自由に選べる（補題 2.3）。像の頂点と紙の隅の
  // 「両方」を折り点にしないと、隅をまたぐ辺が合同にならない。
  const marks=new Set();
  for(let i=0;i<P.length;i++)marks.add(((cumP[i]%total)+total)%total);
  for(let k=0;k<4;k++)marks.add(((off+k*W)%total+total)%total);
  const sorted=[...marks].sort((a,b)=>a-b);
  const uniq=[];
  for(const s of sorted)if(!uniq.length||Math.abs(s-uniq[uniq.length-1])>1e-9)uniq.push(s);
  if(uniq.length>1&&Math.abs(uniq[0]+total-uniq[uniq.length-1])<1e-9)uniq.pop();
  // 像 L 上の弧長 s における点
  const gL=s=>{
    s=((s%total)+total)%total;
    let i=0;while(i<P.length-1&&cumP[i+1]<=s+1e-12)i++;
    const seg=cumP[i+1]-cumP[i];
    if(seg<1e-15)return[...P[i]];
    const u=(s-cumP[i])/seg;
    return add(P[i],mul(sub(P[(i+1)%P.length],P[i]),u));
  };
  const V=[],F=[];
  for(const s of uniq){V.push(gP(s-off,W));F.push(gL(s));}
  return {V,F,W,Q:res.Q,r:res.r,L:P,tips,off,cum:cumP,bridgePlan:L0.bridgePlan,
          lCross:countLCrossings(P)};
}

/* ============================================================
   (B) Demaine–Ku 折線計算
   ============================================================ */
function rayExit(V,o,d){
  let best=Infinity;const BIG=1e6;
  const far=add(o,mul(d,BIG));
  for(let i=0;i<V.length;i++){
    const r=segInt(o,far,V[i],V[(i+1)%V.length]);
    if(!r)continue;
    const[t,s]=r;
    if(t>1e-9&&s>=-1e-9&&s<=1+1e-9)best=Math.min(best,t*BIG);
  }
  return best>1e17?0:best;
}
function splitPoint(V,F,iv,iu,iw,vo,d,fo,qd,tmax){
  const n=V.length;
  const dmin=t=>{
    const p=add(vo,mul(d,t)),q=add(fo,mul(qd,t));
    let m=Infinity;
    for(let k=0;k<n;k++){
      if(k===iv||k===iu||k===iw)continue;
      const val=dist(p,V[k])-dist(q,F[k]);
      if(val<m)m=val;
    }
    return m;
  };
  let t;
  if(dmin(tmax)>=-1e-9)t=tmax;
  else{
    let lo=1e-9,hi=tmax;
    for(let i=0;i<70;i++){const mid=(lo+hi)/2;if(dmin(mid)>=0)lo=mid;else hi=mid;}
    t=lo;
  }
  if(t<=1e-7)return null;
  const p=add(vo,mul(d,t)),q=add(fo,mul(qd,t));
  let best=null;
  for(let k=0;k<n;k++){
    if(k===iv||k===iu||k===iw)continue;
    const val=Math.abs(dist(p,V[k])-dist(q,F[k]));
    if(val<GEO_TOL*100&&visible(V,p,V[k])){if(!best||val<best[0])best=[val,k];}
  }
  if(!best){
    for(let k=0;k<n;k++){
      if(k===iv||k===iu||k===iw)continue;
      const val=Math.abs(dist(p,V[k])-dist(q,F[k]));
      if(visible(V,p,V[k])&&(!best||val<best[0]))best=[val,k];
    }
    if(!best||best[0]>GEO_TOL*1e4)return null;
  }
  return{p,q,x:best[1]};
}
function cyc(a,b,n){const out=[];let k=a;for(;;){out.push(k);if(k===b)break;k=(k+1)%n;}return out;}

/* Demaine–Ku の再帰。Routine 2 は「どの頂点から折り返すか」「2つの分岐のどちらを取るか」
   に自由度があり、選び方で三角形分割が変わる。分割が変われば層の重なり方も変わるので、
   ここを振ると層数を減らせる（実測で最大 43% 減）。
   opt.r2order で頂点の走査順を、opt.flipBranch で分岐の優先順を変える。
   Routine 1 の候補は実測で常に1個しかなく、こちらに自由度はない。 */
function solveFaces(V,F,out,depth,opt){
  out=out||[];depth=depth||0;opt=opt||{};
  const n=V.length;
  if(depth>400)return out;
  if(n<=3){ if(n===3)out.push({V:V.map(p=>[...p]),F:F.map(p=>[...p]),path:(opt.__path||'')}); return out; }
  // Routine 1
  for(let i=0;i<n;i++){
    for(let j=i+2;j<n;j++){
      if(i===0&&j===n-1)continue;
      if(Math.abs(dist(V[i],V[j])-dist(F[i],F[j]))<GEO_TOL&&visible(V,V[i],V[j])){
        const A=[],AF=[];for(let k=i;k<=j;k++){A.push(V[k]);AF.push(F[k]);}
        solveFaces(A,AF,out,depth+1,Object.assign({},opt,{__path:(opt.__path||'')+'A'}));
        const B=[],BF=[];
        for(let k=j;k<n;k++){B.push(V[k]);BF.push(F[k]);}
        for(let k=0;k<=i;k++){B.push(V[k]);BF.push(F[k]);}
        solveFaces(B,BF,out,depth+1,Object.assign({},opt,{__path:(opt.__path||'')+'B'}));
        return out;
      }
    }
  }
  // Routine 2 — 走査順と分岐順に自由度がある
  const order=opt.r2order?opt.r2order(n):null;
  for(let oi=0;oi<n;oi++){
    const iv=order?order[oi]:oi;
    const iu=(iv-1+n)%n,iw=(iv+1)%n;
    if(dist(F[iu],F[iw])>=dist(V[iu],V[iw])-1e-9)continue;
    const theta=interiorAngle(V,iv);
    const phi=angleAt(F[iu],F[iv],F[iw]);
    if(phi>=theta-1e-9)continue;
    const bu=sub(V[iu],V[iv]);
    const base=Math.atan2(bu[1],bu[0]);
    const sgn=-1;
    const fbu=sub(F[iu],F[iv]);
    const bf=Math.atan2(fbu[1],fbu[0]);
    let sf=cross(fbu,sub(F[iw],F[iv]))<0?-1:1;
    {
      const tf=bf+sf*phi;
      const pred=add(F[iv],mul([Math.cos(tf),Math.sin(tf)],dist(F[iw],F[iv])));
      if(dist(pred,F[iw])>1e-6)sf=-sf;
    }
    const branches=[[(theta-phi)/2,-1],[(theta+phi)/2,1]];
    if(opt.flipBranch)branches.reverse();
    for(const[beta,qs]of branches){
      if(beta<1e-7||beta>theta-1e-7)continue;
      const d=[Math.cos(base+sgn*beta),Math.sin(base+sgn*beta)];
      const qd=[Math.cos(bf+sf*qs*beta),Math.sin(bf+sf*qs*beta)];
      const tmax=rayExit(V,V[iv],d);
      if(tmax<1e-6)continue;
      const res=splitPoint(V,F,iv,iu,iw,V[iv],d,F[iv],qd,tmax);
      if(!res)continue;
      const{p,q,x}=res;
      const A=cyc(iv,x,n),B=cyc(x,iv,n);
      solveFaces([p,...A.map(k=>V[k])],[q,...A.map(k=>F[k])],out,depth+1,Object.assign({},opt,{__path:(opt.__path||'')+'a'}));
      solveFaces([p,...B.map(k=>V[k])],[q,...B.map(k=>F[k])],out,depth+1,Object.assign({},opt,{__path:(opt.__path||'')+'b'}));
      return out;
    }
  }
  return out;
}

/* ---- 面の向き σ と 山谷割り当て ---- */
function faceSigma(f){
  const a=cross(sub(f.V[1],f.V[0]),sub(f.V[2],f.V[0]));
  const b=cross(sub(f.F[1],f.F[0]),sub(f.F[2],f.F[0]));
  return a*b>0?1:-1;
}
/* 幾何判定の許容誤差。紙の一辺 W に比例させる。
   絶対値のままだと、W が大きい形（実測で W > 7）で相対精度が足りず、
   Routine 1 の合同判定が本来見つかるべき分割を見逃して結果が不安定になる。 */
let GEO_TOL=1e-7;
function setGeoTol(W){ GEO_TOL=1e-7*Math.max(1,(isFinite(W)&&W>0)?W:1); }

/* 頂点の同一視に使う量子化。
   固定の toFixed(6) だと、紙が大きい形（実測で W が 7 を超える）では
   相対精度が 1e-7 まで落ちる。Demaine–Ku の split point は二分探索の出力なので
   この粒度に届き、別々の点が同じキーに潰れて辺が壊れる。
   紙の一辺に対する相対量で丸める。 */
let KQ_SCALE=1;
function setKeyScale(W){ KQ_SCALE=(isFinite(W)&&W>0)?W:1; }
const kq=p=>(p[0]/KQ_SCALE).toFixed(9)+','+(p[1]/KQ_SCALE).toFixed(9);
function edgeKey(a,b){const ka=kq(a),kb=kq(b);return ka<kb?ka+'|'+kb:kb+'|'+ka;}
