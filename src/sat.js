const ovNow=()=>(typeof performance!=="undefined"&&performance.now)?performance.now():Date.now();
/* ============================================================
   Small CDCL SAT solver (MiniSat-style)
   - two watched literals, 1UIP learning with recursive-free minimisation,
     VSIDS (binary heap), phase saving, Luby restarts, learnt-clause reduction.
   - input: nVars, clauses as arrays of DIMACS literals (±v, v>=1)
   - output: {status:'sat'|'unsat'|'unknown', model:Int8Array(nVars+1) (1/-1)}
   ============================================================ */
function satSolve(nVars, clausesIn, opt){
  opt=opt||{};
  const maxConflicts=opt.maxConflicts||5e6;
  const deadline=opt.timeLimitMs?ovNow()+opt.timeLimitMs:Infinity;
  const nv=nVars;
  const val=new Int8Array(nv+1);           // 0 unassigned, 1 true, -1 false
  const level=new Int32Array(nv+1);
  const reason=new Int32Array(nv+1).fill(-1);
  const trail=new Int32Array(nv+1);
  let tl=0,qhead=0;
  const trailLim=[];
  const cls=[];                              // Int32Array, literal codes
  const learnt=[];                           // bool per clause
  const cact=[];                             // clause activity
  const watches=new Array(2*nv+2);
  for(let i=0;i<watches.length;i++)watches[i]=[];
  const act=new Float64Array(nv+1);
  let vinc=1, cinc=1;
  const phase=new Int8Array(nv+1);           // saved polarity (0 => false)
  const seen=new Uint8Array(nv+1);
  const stats={conflicts:0,decisions:0,props:0,learnts:0,restarts:0};
  const enc=x=>x>0?2*x:2*(-x)+1;
  const lv=l=>{const v=val[l>>1];return (l&1)?-v:v;};   // 1 true, -1 false, 0 free

  // ---- VSIDS heap ----
  const heap=[];const hpos=new Int32Array(nv+1).fill(-1);
  const less=(a,b)=>act[a]>act[b];
  function hUp(i){const v=heap[i];while(i>0){const p=(i-1)>>1;if(!less(v,heap[p]))break;heap[i]=heap[p];hpos[heap[i]]=i;i=p;}heap[i]=v;hpos[v]=i;}
  function hDown(i){const v=heap[i];const n=heap.length;for(;;){let c=2*i+1;if(c>=n)break;if(c+1<n&&less(heap[c+1],heap[c]))c++;if(!less(heap[c],v))break;heap[i]=heap[c];hpos[heap[i]]=i;i=c;}heap[i]=v;hpos[v]=i;}
  function hInsert(v){if(hpos[v]>=0)return;heap.push(v);hpos[v]=heap.length-1;hUp(heap.length-1);}
  function hPop(){const v=heap[0];const last=heap.pop();hpos[v]=-1;if(heap.length){heap[0]=last;hpos[last]=0;hDown(0);}return v;}
  for(let v=1;v<=nv;v++)hInsert(v);
  function bump(v){act[v]+=vinc;if(act[v]>1e100){for(let k=1;k<=nv;k++)act[k]*=1e-100;vinc*=1e-100;}if(hpos[v]>=0)hUp(hpos[v]);}

  function enqueue(l,r){const v=l>>1;val[v]=(l&1)?-1:1;level[v]=trailLim.length;reason[v]=r;trail[tl++]=l;}
  function attach(ci){const c=cls[ci];watches[c[0]].push(ci);watches[c[1]].push(ci);}

  // ---- load clauses ----
  for(const raw of clausesIn){
    const s=new Set();let taut=false;
    for(const x of raw){const l=enc(x);if(s.has(l^1)){taut=true;break;}s.add(l);}
    if(taut)continue;
    const c=Int32Array.from(s);
    if(c.length===0)return {status:'unsat',stats,reason:'empty clause'};
    if(c.length===1){
      const t=lv(c[0]);
      if(t===-1)return {status:'unsat',stats,reason:'conflicting units'};
      if(t===0)enqueue(c[0],-1);
      continue;
    }
    cls.push(c);learnt.push(false);cact.push(0);attach(cls.length-1);
  }

  function propagate(){
    while(qhead<tl){
      const p=trail[qhead++];const fl=p^1;const ws=watches[fl];
      stats.props++;
      let i=0,j=0;const n=ws.length;
      while(i<n){
        const ci=ws[i++];const c=cls[ci];
        if(c===null)continue;               // deleted
        if(c[0]===fl){c[0]=c[1];c[1]=fl;}
        if(lv(c[0])===1){ws[j++]=ci;continue;}
        let found=false;
        for(let k=2;k<c.length;k++){
          if(lv(c[k])!==-1){c[1]=c[k];c[k]=fl;watches[c[1]].push(ci);found=true;break;}
        }
        if(found)continue;
        ws[j++]=ci;
        if(lv(c[0])===-1){while(i<n)ws[j++]=ws[i++];ws.length=j;qhead=tl;return ci;}
        enqueue(c[0],ci);
      }
      ws.length=j;
    }
    return -1;
  }

  function analyze(confl){
    const out=[0];let pathC=0,p=-1,idx=tl-1;const cur=trailLim.length;
    do{
      const c=cls[confl];
      if(learnt[confl]){cact[confl]+=cinc;}
      for(let k=(p===-1?0:1);k<c.length;k++){
        const q=c[k],v=q>>1;
        if(!seen[v]&&level[v]>0){
          seen[v]=1;bump(v);
          if(level[v]>=cur)pathC++;else out.push(q);
        }
      }
      while(!seen[trail[idx]>>1])idx--;
      p=trail[idx];idx--;confl=reason[p>>1];seen[p>>1]=0;pathC--;
    }while(pathC>0);
    out[0]=p^1;
    // local minimisation: drop literals whose reason is subsumed by the clause
    const keep=[out[0]];
    for(let k=1;k<out.length;k++){
      const v=out[k]>>1,r=reason[v];
      if(r<0){keep.push(out[k]);continue;}
      const c=cls[r];let red=true;
      for(let m=1;m<c.length;m++){const u=c[m]>>1;if(!seen[u]&&level[u]>0){red=false;break;}}
      if(!red)keep.push(out[k]);
    }
    for(let k=1;k<out.length;k++)seen[out[k]>>1]=0;
    let bt=0,bi=1;
    for(let k=1;k<keep.length;k++){const l=level[keep[k]>>1];if(l>bt){bt=l;bi=k;}}
    if(keep.length>1){const t=keep[1];keep[1]=keep[bi];keep[bi]=t;}
    return {lits:keep,bt};
  }
  function cancelUntil(lvl){
    if(trailLim.length<=lvl)return;
    const stop=trailLim[lvl];
    for(let k=tl-1;k>=stop;k--){const v=trail[k]>>1;phase[v]=val[v];val[v]=0;reason[v]=-1;hInsert(v);}
    tl=stop;qhead=stop;trailLim.length=lvl;
  }
  function reduceDB(){
    const cand=[];
    for(let ci=0;ci<cls.length;ci++){
      if(!learnt[ci]||cls[ci]===null)continue;
      const c=cls[ci];if(c.length<=2)continue;
      const v0=c[0]>>1;if(reason[v0]===ci&&val[v0]!==0)continue;   // locked
      cand.push(ci);
    }
    cand.sort((a,b)=>cact[a]-cact[b]);
    const nDel=cand.length>>1;
    for(let k=0;k<nDel;k++){cls[cand[k]]=null;stats.learnts--;}
    for(const ws of watches){let j=0;for(let i=0;i<ws.length;i++)if(cls[ws[i]]!==null)ws[j++]=ws[i];ws.length=j;}
  }
  const luby=(y,x)=>{let size=1,seq=0;while(size<x+1){seq++;size=2*size+1;}while(size-1!==x){size=(size-1)>>1;seq--;x=x%size;}return Math.pow(y,seq);};

  if(propagate()>=0)return {status:'unsat',stats,reason:'level-0 conflict'};
  let rest=0,maxLearnts=Math.max(2000,cls.length/3);
  for(;;){
    const budget=luby(2,rest++)*100;let nconf=0;
    for(;;){
      const confl=propagate();
      if(confl>=0){
        stats.conflicts++;nconf++;
        if(trailLim.length===0)return {status:'unsat',stats};
        const {lits,bt}=analyze(confl);
        cancelUntil(bt);
        if(lits.length===1)enqueue(lits[0],-1);
        else{
          const c=Int32Array.from(lits);cls.push(c);learnt.push(true);cact.push(cinc);
          stats.learnts++;attach(cls.length-1);enqueue(c[0],cls.length-1);
        }
        vinc*=1/0.95;cinc*=1/0.999;
        if(cinc>1e20){for(let k=0;k<cact.length;k++)cact[k]*=1e-20;cinc*=1e-20;}
        if(stats.conflicts>=maxConflicts||(stats.conflicts%256===0&&ovNow()>deadline))
          return {status:'unknown',stats};
      }else{
        if(nconf>=budget){cancelUntil(0);stats.restarts++;break;}
        if(stats.learnts-tl>=maxLearnts){reduceDB();maxLearnts*=1.1;}
        let v=0;
        while(heap.length){const u=hPop();if(val[u]===0){v=u;break;}}
        if(v===0){
          const model=new Int8Array(nv+1);for(let k=1;k<=nv;k++)model[k]=val[k];
          return {status:'sat',model,stats};
        }
        stats.decisions++;trailLim.push(tl);
        enqueue(phase[v]===1?2*v:2*v+1,-1);
      }
    }
  }
}
