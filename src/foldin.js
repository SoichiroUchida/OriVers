/* ============================================================
   Fold-in post-processing (paper §9, after SandyDarwin):
   for each supporting line l of conv(T) (T on the left), fold every part of the
   folded state lying right of l under the whole stack (simple fold).
   New order: kept-kept unchanged, moved-moved reversed, kept above moved.
   Paper and image coordinates are clipped together (same interpolation
   parameter), so no per-face transform has to be fitted.
   ============================================================ */
function fiHull(Ts){
  const pts=[];for(const t of Ts)for(const p of t)pts.push([p[0],p[1]]);
  pts.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
  const lo=[],up=[];
  for(const p of pts){while(lo.length>=2&&cr(lo[lo.length-2],lo[lo.length-1],p)<=0)lo.pop();lo.push(p);}
  for(let i=pts.length-1;i>=0;i--){const p=pts[i];while(up.length>=2&&cr(up[up.length-2],up[up.length-1],p)<=0)up.pop();up.push(p);}
  up.pop();lo.pop();return lo.concat(up);              // CCW
}
function fiArea(P){let s=0;for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length];s+=a[0]*b[1]-b[0]*a[1];}return Math.abs(s)/2;}
/* clip paired polygon (V,F) by the half plane sgn*<F-a,n> >= 0 */
function fiClip(V,F,a,n,sgn){
  const oV=[],oF=[];const m=F.length;
  const d=F.map(p=>sgn*((p[0]-a[0])*n[0]+(p[1]-a[1])*n[1]));
  const eps=1e-12;
  for(let k=0;k<m;k++){
    const k2=(k+1)%m;
    if(d[k]>=-eps){oV.push(V[k]);oF.push(F[k]);}
    if((d[k]>=-eps)!==(d[k2]>=-eps)){
      const t=d[k]/(d[k]-d[k2]);
      oV.push([V[k][0]+t*(V[k2][0]-V[k][0]),V[k][1]+t*(V[k2][1]-V[k][1])]);
      oF.push([F[k][0]+t*(F[k2][0]-F[k][0]),F[k][1]+t*(F[k2][1]-F[k][1])]);
    }
  }
  const rV=[],rF=[];
  for(let k=0;k<oF.length;k++){
    const q=oF[k],p=rF[rF.length-1];
    if(!p||Math.hypot(q[0]-p[0],q[1]-p[1])>1e-13||Math.hypot(oV[k][0]-rV[rV.length-1][0],oV[k][1]-rV[rV.length-1][1])>1e-13){rV.push(oV[k]);rF.push(q);}
  }
  if(rF.length>1){const p=rF[0],q=rF[rF.length-1];if(Math.hypot(p[0]-q[0],p[1]-q[1])<=1e-13&&Math.hypot(rV[0][0]-rV[rV.length-1][0],rV[0][1]-rV[rV.length-1][1])<=1e-13){rF.pop();rV.pop();}}
  return {V:rV,F:rF};
}
function fiReflect(F,a,d){
  const L=Math.hypot(d[0],d[1]),u=[d[0]/L,d[1]/L];
  return F.map(p=>{const x=p[0]-a[0],y=p[1]-a[1],t=x*u[0]+y*u[1];return [a[0]+2*t*u[0]-x,a[1]+2*t*u[1]-y];});
}
/* one simple fold-under along the oriented line (a, a+d); pieces: [{V,F,s}], P: Uint8Array n*n */
function fiFoldUnder(pieces,P,a,d,W){
  const n=pieces.length,L=Math.hypot(d[0],d[1]),nl=[-d[1]/L,d[0]/L];
  const aeps=1e-14*Math.max(1,W*W);
  const out=[],src=[],moved=[];let any=false;
  pieces.forEach((pc,i)=>{
    for(const keep of [true,false]){
      const c=fiClip(pc.V,pc.F,a,nl,keep?1:-1);
      if(c.F.length<3||fiArea(c.F)<=aeps&&fiArea(c.V)<=aeps)continue;
      if(!keep){any=true;out.push({V:c.V,F:fiReflect(c.F,a,d),s:-pc.s});}
      else out.push({V:c.V,F:c.F,s:pc.s});
      src.push(i);moved.push(!keep);
    }
  });
  const m=out.length,Q=new Uint8Array(m*m);
  for(let x=0;x<m;x++)for(let y=0;y<m;y++){
    if(x===y)continue;const i=src[x],j=src[y];
    if(!moved[x]&&!moved[y])Q[x*m+y]=P[i*n+j];
    else if(moved[x]&&moved[y])Q[x*m+y]=i!==j?P[j*n+i]:0;
    else Q[x*m+y]=moved[x]?0:1;
  }
  return {pieces:out,P:Q,changed:any};
}
/* full fold-in; returns a new candidate (triangulated faces) and its order matrix */
function foldIn(cand,P,Ts,opt){
  opt=opt||{};
  const n=cand.faces.length;
  let pieces=cand.faces.map(f=>({V:f.V.map(p=>[...p]),F:f.F.map(p=>[...p]),s:f.s}));
  let Q=P;
  const H=fiHull(Ts),lines=H.map((p,k)=>[p,[H[(k+1)%H.length][0]-p[0],H[(k+1)%H.length][1]-p[1]]]);
  let rounds=0;
  for(;rounds<(opt.maxRounds||30);rounds++){
    let ch=false;
    for(const [a,d] of lines){const r=fiFoldUnder(pieces,Q,a,d,cand.W);pieces=r.pieces;Q=r.P;ch=ch||r.changed;}
    if(!ch)break;
  }
  // fan-triangulate pieces
  const faces=[],owner=[];
  pieces.forEach((pc,i)=>{for(let k=1;k<pc.V.length-1;k++){faces.push({V:[pc.V[0],pc.V[k],pc.V[k+1]],F:[pc.F[0],pc.F[k],pc.F[k+1]],s:pc.s});owner.push(i);}});
  const m=faces.length,Pt=new Uint8Array(m*m),np_=pieces.length;
  for(let x=0;x<m;x++)for(let y=0;y<m;y++)if(owner[x]!==owner[y])Pt[x*m+y]=Q[owner[x]*np_+owner[y]];
  const nc=Object.assign({},cand,{faces});
  return {cand:nc,P:Pt,rounds,hull:H};
}
/* triangulate pieces into a candidate + order matrix */
function fiTriangulate(cand,pieces,Q){
  const faces=[],owner=[];
  pieces.forEach((pc,i)=>{for(let k=1;k<pc.V.length-1;k++){faces.push({V:[pc.V[0],pc.V[k],pc.V[k+1]],F:[pc.F[0],pc.F[k],pc.F[k+1]],s:pc.s});owner.push(i);}});
  const m=faces.length,Pt=new Uint8Array(m*m),np_=pieces.length;
  for(let x=0;x<m;x++)for(let y=0;y<m;y++)if(owner[x]!==owner[y])Pt[x*m+y]=Q[owner[x]*np_+owner[y]];
  return {cand:Object.assign({},cand,{faces}),P:Pt};
}
/* cap-safe fold-in: a fold along a support line is kept only if the whole
   cap CNF (Justin + D + zips + strong cap) is still satisfied afterwards */
function foldInCap(cand,P,Ts,H,opt){
  opt=opt||{};
  let pieces=cand.faces.map(f=>({V:f.V.map(p=>[...p]),F:f.F.map(p=>[...p]),s:f.s}));
  let Q=P;
  const Hh=fiHull(Ts),lines=Hh.map((p,k)=>[p,[Hh[(k+1)%Hh.length][0]-p[0],Hh[(k+1)%Hh.length][1]-p[1]]]);
  const bad=new Set();let rounds=0,accepted=0,rejected=0;
  for(;rounds<(opt.maxRounds||20);rounds++){
    let ch=false;
    for(let li=0;li<lines.length;li++){
      if(bad.has(li))continue;
      const [a,d]=lines[li];
      const r=fiFoldUnder(pieces,Q,a,d,cand.W);
      if(!r.changed)continue;
      const t=fiTriangulate(cand,r.pieces,r.P);
      const M=buildLayerModel(t.cand,{cap:true});M.T=Ts;M.H=H||[];
      const v=countViolated(M.clauses,modelFromP(t.P,M));
      if(v===0){pieces=r.pieces;Q=r.P;ch=true;accepted++;}else{bad.add(li);rejected++;}
    }
    if(!ch)break;
  }
  const t=fiTriangulate(cand,pieces,Q);
  return {cand:t.cand,P:t.P,rounds,hull:Hh,accepted,rejected};
}
/* fold-in + re-certification with the same CNF as the solver */
function foldInCertified(res,Ts,H,opt){
  opt=opt||{};
  const fi=opt.cap?foldInCap(res.cand,res.P,Ts,H,opt):foldIn(res.cand,res.P,Ts,opt);
  const M=buildLayerModel(fi.cand,{cap:!!opt.cap});M.T=Ts;M.H=H||[];M.paper=res.cand.paper;
  const model=modelFromP(fi.P,M);
  const viol=countViolated(M.clauses,model);
  const ck=checkOrder(M,fi.P);
  const creases=mvFromOrder(M,fi.P);
  const mk=maekawa(M,creases);
  return {ok:viol===0&&ck.not_total===0&&ck.back_on_top>1-1e-9&&!(ck.back_out>0),accepted:fi.accepted,rejected:fi.rejected,cand:fi.cand,model:M,P:fi.P,creases,check:ck,maekawa:mk,violated:viol,rounds:fi.rounds,hull:fi.hull};
}
/* protrusion of the folded image outside T after fold-in, estimated on a grid
   (used only to order candidates; certification is exact and independent) */
function fiProtrusion(cand,Ts,H,res){
  res=res||160;
  const n=cand.faces.length,P0=new Uint8Array(n*n);
  const fi=foldIn(cand,P0,Ts);
  const tris=fi.cand.faces.map(f=>f.F);
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  for(const t of tris)for(const p of t){x0=Math.min(x0,p[0]);y0=Math.min(y0,p[1]);x1=Math.max(x1,p[0]);y1=Math.max(y1,p[1]);}
  const bb=tris.map(t=>[Math.min(t[0][0],t[1][0],t[2][0]),Math.min(t[0][1],t[1][1],t[2][1]),Math.max(t[0][0],t[1][0],t[2][0]),Math.max(t[0][1],t[1][1],t[2][1])]);
  const inTri=(t,x,y)=>{const c=(a,b)=>(b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0]);const d1=c(t[0],t[1]),d2=c(t[1],t[2]),d3=c(t[2],t[0]);return (d1>=0&&d2>=0&&d3>=0)||(d1<=0&&d2<=0&&d3<=0);};
  const inPoly=(V,x,y)=>{let c=false;for(let i=0,j=V.length-1;i<V.length;j=i++){const a=V[i],b=V[j];if(((a[1]>y)!==(b[1]>y))&&(x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]))c=!c;}return c;};
  const inT=(x,y)=>{let k=false;for(const t of Ts)if(inPoly(t,x,y))k=!k;for(const h of (H||[]))if(inPoly(h,x,y))k=false;return k;};
  const dx=(x1-x0)/res,dy=(y1-y0)/res;let out=0,inside=0;
  for(let i=0;i<res;i++)for(let j=0;j<res;j++){
    const x=x0+(i+.5)*dx,y=y0+(j+.5)*dy;
    const t=inT(x,y);if(t){inside++;continue;}
    for(let k=0;k<tris.length;k++){const b=bb[k];if(x<b[0]||x>b[2]||y<b[1]||y>b[3])continue;if(inTri(tris[k],x,y)){out++;break;}}
  }
  return inside?out/inside:0;
}
