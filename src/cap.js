/* ============================================================
   OriVers-cap: boundary structure (dT traversal vs zipped spurs/bridges)
   and the cap constraints (virtual top face D = T glued to the raw edges).
   Port of capsat.py, but built directly from the faces' boundary edges so
   that it also works after fold-in.
   ============================================================ */
function capParam(paper,p){
  // arc-length parameter of point p on the (CCW) paper polygon
  let best=null,acc=0;
  for(let i=0;i<paper.length;i++){
    const A=paper[i],B=paper[(i+1)%paper.length];
    const L=Math.hypot(B[0]-A[0],B[1]-A[1]);
    let t=L>0?((p[0]-A[0])*(B[0]-A[0])+(p[1]-A[1])*(B[1]-A[1]))/L:0;t=Math.max(0,Math.min(L,t));
    const q=[A[0]+(B[0]-A[0])*t/(L||1),A[1]+(B[1]-A[1])*t/(L||1)];
    const dd=Math.hypot(q[0]-p[0],q[1]-p[1]);
    if(!best||dd<best[0])best=[dd,acc+t];
    acc+=L;
  }
  return best[1];
}
function capPerimeter(paper){let s=0;for(let i=0;i<paper.length;i++){const A=paper[i],B=paper[(i+1)%paper.length];s+=Math.hypot(B[0]-A[0],B[1]-A[1]);}return s;}
/* boundary face-edges -> atoms -> (D traversal, zip pairs) */
function capStructure(d,V,F,n,degen,variant){
  variant=variant||0;
  const paper=d.paper||[[0,0],[d.W,0],[d.W,d.W],[0,d.W]];
  const Per=capPerimeter(paper);
  const W=d.W,q=1e7/Math.max(1,W);
  const key=p=>Math.round(p[0]*q)+','+Math.round(p[1]*q);
  const emap=new Map();
  for(let i=0;i<n;i++){if(degen&&degen[i])continue;for(let k=0;k<3;k++){
    const ka=key(V[i][k]),kb=key(V[i][(k+1)%3]);const e=ka<kb?ka+'|'+kb:kb+'|'+ka;
    if(!emap.has(e))emap.set(e,[]);emap.get(e).push([i,k]);
  }}
  const bed=[];
  for(const lst of emap.values()){
    if(lst.length!==1)continue;
    const [i,k]=lst[0];
    let pa=V[i][k],pb=V[i][(k+1)%3],A=F[i][k],B=F[i][(k+1)%3];
    let sa=capParam(paper,pa),sb=capParam(paper,pb);
    if((((sb-sa)%Per)+Per)%Per>Per/2){[sa,sb]=[sb,sa];[A,B]=[B,A];}
    if(sb<sa)sb+=Per;
    bed.push({f:i,s0:sa,s1:sb,A,B});
  }
  bed.sort((x,y)=>x.s0-y.s0);
  let ext=1;for(const e of bed)for(const p of [e.A,e.B])ext=Math.max(ext,Math.abs(p[0]),Math.abs(p[1]));
  const tol=1e-7*ext,qk=1/tol;
  const kp=p=>Math.round(p[0]*qk)+','+Math.round(p[1]*qk);
  const verts=[];const vs=new Set();
  for(const e of bed)for(const p of [e.A,e.B]){const kk=kp(p);if(!vs.has(kk)){vs.add(kk);verts.push(p);}}
  const atoms=[];
  for(const e of bed){
    const L=Math.hypot(e.B[0]-e.A[0],e.B[1]-e.A[1]);if(L<tol)continue;
    const u=[(e.B[0]-e.A[0])/L,(e.B[1]-e.A[1])/L];
    const ts=[0,L];
    for(const p of verts){const w=[p[0]-e.A[0],p[1]-e.A[1]];const t=w[0]*u[0]+w[1]*u[1];
      if(t>tol&&t<L-tol&&Math.abs(w[0]*u[1]-w[1]*u[0])<10*tol)ts.push(t);}
    ts.sort((a,b)=>a-b);
    for(let j=0;j+1<ts.length;j++){const a=ts[j],b=ts[j+1];if(b-a<tol)continue;
      const PA=[e.A[0]+u[0]*a,e.A[1]+u[1]*a],PB=[e.A[0]+u[0]*b,e.A[1]+u[1]*b];
      atoms.push({f:e.f,s0:e.s0+(e.s1-e.s0)*a/L,s1:e.s0+(e.s1-e.s0)*b/L,ka:kp(PA),kb:kp(PB),A:PA,B:PB});}
  }
  atoms.sort((x,y)=>x.s0-y.s0);
  // dT membership
  const rings=[...d.T,...(d.holes||[])];
  const onDT=(A,B)=>{
    for(const r of rings)for(let i=0;i<r.length;i++){
      const P=r[i],Q=r[(i+1)%r.length];
      if(ovDistSeg(A,P,Q)<=20*tol&&ovDistSeg(B,P,Q)<=20*tol)return true;}
    return false;};
  const inv=(i,j)=>atoms[i].ka===atoms[j].kb&&atoms[i].kb===atoms[j].ka;
  let word=atoms.map((_,i)=>i);const zips=[],dset=[];
  // pairing variants: the cyclic free reduction is order dependent when three or more
  // boundary pieces overlap (e.g. up, back, up); rotate / reverse the cyclic word
  if(variant&1)word.reverse();
  {const r=(variant>>1)%Math.max(1,word.length);const k=Math.floor(r*word.length/4)%Math.max(1,word.length);word=word.slice(k).concat(word.slice(0,k));}
  const invPair=(i,j)=>(variant&1)?inv(j,i):inv(i,j);
  let changed=true;
  while(changed&&word.length){
    changed=false;const st=[];
    for(const w of word){if(st.length&&invPair(st[st.length-1],w)){zips.push([st.pop(),w]);changed=true;}else st.push(w);}
    while(st.length>=2&&invPair(st[st.length-1],st[0])){zips.push([st.pop(),st.shift()]);changed=true;}
    word=st;
    if(changed)continue;
    const m=word.length;
    for(let i=0;i<m&&!changed;i++){
      if(!onDT(atoms[word[i]].A,atoms[word[i]].B))continue;
      let j=i,ok=false;
      while(j-i<=m){const a=atoms[word[j%m]];if(!onDT(a.A,a.B))break;if(((variant&1)?a.ka===atoms[word[i]].kb:a.kb===atoms[word[i]].ka)){ok=true;break;}j++;}
      if(ok&&(j-i+1)<m){const loop=new Set();for(let k=i;k<=j;k++)loop.add(word[k%m]);for(const x of loop)dset.push(x);word=word.filter(w=>!loop.has(w));changed=true;}
    }
  }
  for(const w of word)dset.push(w);
  let notOn=dset.filter(i=>!onDT(atoms[i].A,atoms[i].B)).length;
  // the contour part must trace every edge of dT exactly once, all in one direction
  {let sgn=0;
   const nT=d.T.length;
   rings.forEach((r,ri)=>{let ar=0;for(let k=0;k<r.length;k++){const a=r[k],b=r[(k+1)%r.length];ar+=a[0]*b[1]-b[0]*a[1];}
     const o=(ar>0?1:-1)*(ri<nT?1:-1);       // outer rings and holes are traversed in opposite senses
     for(let k=0;k<r.length;k++){
     const P=r[k],Q=r[(k+1)%r.length],L=Math.hypot(Q[0]-P[0],Q[1]-P[1]);if(L<tol)continue;
     const u=[(Q[0]-P[0])/L,(Q[1]-P[1])/L];const ev=[];
     for(const i of dset){const a=atoms[i];
       if(ovDistSeg(a.A,P,Q)>20*tol||ovDistSeg(a.B,P,Q)>20*tol)continue;
       const ta=(a.A[0]-P[0])*u[0]+(a.A[1]-P[1])*u[1],tb=(a.B[0]-P[0])*u[0]+(a.B[1]-P[1])*u[1];
       const d=(tb>ta?1:-1)*o;ev.push([Math.min(ta,tb),d],[Math.max(ta,tb),-d]);}
     ev.sort((x,y)=>x[0]-y[0]);let c=0,last=0,bad=false;
     for(const [t,d] of ev){if(t-last>tol&&(c===0||Math.abs(c)!==1||(sgn&&c!==sgn)))bad=true;if(t-last>tol&&c)sgn=sgn||c;c+=d;last=Math.max(last,t);}
     if(L-last>tol)bad=true;
     if(bad)notOn++;}});
  }
  return {atoms,zips,dset,notOnDT:notOn,
          dLen:dset.reduce((t,i)=>t+Math.hypot(atoms[i].B[0]-atoms[i].A[0],atoms[i].B[1]-atoms[i].A[1]),0)};
}
