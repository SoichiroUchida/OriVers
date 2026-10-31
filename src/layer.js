/* ============================================================
   OriVers: candidates, exact layer-order model, M/V, checks
   (JS port of core/cands.js + core/layer.py + core/mv.py)
   ============================================================ */

/* ---------- candidate crease patterns (= core/cands.js) ---------- */
const OV_PHASES=[0,0.13,0.29,0.41,0.57,0.71,0.83,0.07,0.21,0.36,0.5,0.64,0.78,0.92];
const OV_SQUARE=[[0,0],[1,0],[1,1],[0,1]];
function ovAbsArea(P){let s=0;for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length];s+=a[0]*b[1]-b[0]*a[1];}return Math.abs(s)/2;}
function ovShuf(n,seed){const a=Array.from({length:n},(_,k)=>k);let s=seed;const r=()=>{s=(s*1103515245+12345)&0x7fffffff;return s/0x7fffffff;};for(let i=n-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
/* generator: yields distinct candidates one by one, in exactly the order of core/cands.js */
function* candidates(Ts,H,maxC){
  maxC=maxC||40;H=H||[];
  const seen=new Set();let count=0;
  for(const ph of OV_PHASES){
    let ba=null;try{ba=boundaryAssignment(OV_SQUARE,Ts.map(t=>t.map(p=>[...p])),H.map(t=>t.map(p=>[...p])),ph*1);}catch(e){}
    if(!ba)continue;
    for(let seed=0;seed<12;seed++){
      setGeoTol(ba.W);
      const opt=seed===0?{}:((seed%2)?{flipBranch:true,r2order:k=>ovShuf(k,seed)}:{r2order:k=>ovShuf(k,seed)});
      let f=null;try{f=solveFaces(ba.V.map(p=>[...p]),ba.F.map(p=>[...p]),[],0,opt);}catch(e){continue;}
      const tile=f.reduce((t,x)=>t+ovAbsArea(x.V),0)/(ba.W*ba.W);
      if(Math.abs(tile-1)>1e-6)continue;
      const sig=f.map(x=>x.V.flat().map(v=>v.toFixed(5)).join(',')).sort().join(';');
      if(seen.has(sig))continue;seen.add(sig);
      yield {T:Ts,holes:H,W:ba.W,paper:[[0,0],[ba.W,0],[ba.W,ba.W],[0,ba.W]],paperKind:'legacy',Q:ba.Q,r:ba.r,phase:ph,seed,L:ba.L,index:count,
             faces:f.map(x=>({V:x.V,F:x.F,s:faceSigma(x)}))};
      if(++count>=maxC)return;
    }
  }
}

/* ---------- small geometry helpers ---------- */
function ovCCW(P){return signedArea(P)>0?P.map(p=>[...p]):P.map(p=>[...p]).reverse();}
function ovBBox(P){let a=Infinity,b=Infinity,c=-Infinity,d=-Infinity;for(const p of P){if(p[0]<a)a=p[0];if(p[1]<b)b=p[1];if(p[0]>c)c=p[0];if(p[1]>d)d=p[1];}return [a,b,c,d];}
function ovBBHit(A,B,e){return !(A[2]<B[0]-e||B[2]<A[0]-e||A[3]<B[1]-e||B[3]<A[1]-e);}
/* Sutherland–Hodgman clip of a polygon by a convex CCW polygon */
function ovClip(subject,clip){
  let out=subject;
  for(let i=0;i<clip.length&&out.length;i++){
    const A=clip[i],B=clip[(i+1)%clip.length];
    const ex=B[0]-A[0],ey=B[1]-A[1];
    const sd=p=>ex*(p[1]-A[1])-ey*(p[0]-A[0]);
    const inp=out;out=[];
    for(let j=0;j<inp.length;j++){
      const P=inp[j],Q=inp[(j+1)%inp.length];
      const dp=sd(P),dq=sd(Q);
      if(dp>=0)out.push(P);
      if((dp>=0)!==(dq>=0)){const t=dp/(dp-dq);out.push([P[0]+(Q[0]-P[0])*t,P[1]+(Q[1]-P[1])*t]);}
    }
  }
  return out;
}
/* parameter interval of segment P->Q inside convex CCW polygon shrunk by e (= shapely poly.buffer(-e)) */
function ovSegInConvex(P,Q,poly,e){
  let t0=0,t1=1;const dx=Q[0]-P[0],dy=Q[1]-P[1];
  for(let i=0;i<poly.length;i++){
    const A=poly[i],B=poly[(i+1)%poly.length];
    const ex=B[0]-A[0],ey=B[1]-A[1],L=Math.hypot(ex,ey);
    if(L<=e*1e-3)continue;            // degenerate (near-duplicate vertices): no direction
    // signed distance (inside positive) of P+t(Q-P):  f0 + t*f1  >= e
    const f0=(ex*(P[1]-A[1])-ey*(P[0]-A[0]))/L, f1=(ex*dy-ey*dx)/L;
    if(Math.abs(f1)<1e-300){if(f0<e)return 0;continue;}
    const t=(e-f0)/f1;
    if(f1>0){if(t>t0)t0=t;}else{if(t<t1)t1=t;}
    if(t0>=t1)return 0;
  }
  return (t1-t0)*Math.hypot(dx,dy);
}
/* length of segment P->Q inside the eps-capsule around segment A-B (= LineString.buffer(eps) ∩ seg) */
function ovSegInCapsule(A,B,P,Q,e){
  const dx=Q[0]-P[0],dy=Q[1]-P[1],Lq=Math.hypot(dx,dy);
  if(Lq===0)return 0;
  let lo=Infinity,hi=-Infinity;
  const take=(a,b)=>{a=Math.max(a,0);b=Math.min(b,1);if(a<=b){if(a<lo)lo=a;if(b>hi)hi=b;}};
  const ux=B[0]-A[0],uy=B[1]-A[1],La=Math.hypot(ux,uy);
  if(La>0){
    // rectangle: |perp| <= e and 0 <= proj <= La
    let a=-Infinity,b=Infinity;
    const lin=(c0,c1,lo_,hi_)=>{ // lo_ <= c0 + c1 t <= hi_
      if(Math.abs(c1)<1e-300){if(c0<lo_||c0>hi_){a=1;b=0;}return;}
      let ta=(lo_-c0)/c1,tb=(hi_-c0)/c1;if(ta>tb){const t=ta;ta=tb;tb=t;}
      if(ta>a)a=ta;if(tb<b)b=tb;
    };
    const px=P[0]-A[0],py=P[1]-A[1];
    lin((ux*py-uy*px)/La,(ux*dy-uy*dx)/La,-e,e);
    lin((ux*px+uy*py)/La,(ux*dx+uy*dy)/La,0,La);
    if(a<=b)take(a,b);
  }
  for(const C of [A,B]){
    // |P + t d - C|^2 <= e^2
    const fx=P[0]-C[0],fy=P[1]-C[1];
    const qa=dx*dx+dy*dy,qb=2*(fx*dx+fy*dy),qc=fx*fx+fy*fy-e*e;
    const disc=qb*qb-4*qa*qc;
    if(disc<0)continue;
    const sq=Math.sqrt(disc);take((-qb-sq)/(2*qa),(-qb+sq)/(2*qa));
  }
  return hi>lo?(hi-lo)*Lq:0;
}
function ovPointInPoly(V,p){
  let c=false;
  for(let i=0,j=V.length-1;i<V.length;j=i++){
    const a=V[i],b=V[j];
    if(((a[1]>p[1])!==(b[1]>p[1]))&&(p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]))c=!c;
  }
  return c;
}
function ovDistSeg(p,a,b){
  const dx=b[0]-a[0],dy=b[1]-a[1],L2=dx*dx+dy*dy;
  let t=L2>0?((p[0]-a[0])*dx+(p[1]-a[1])*dy)/L2:0;t=Math.max(0,Math.min(1,t));
  return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);
}
/* T_region_of(d) of layer.py: (union T) \ holes, shrunk by 1e-6*max(1,W) */
function makeTRegion(Ts,H,W){
  const shrink=1e-6*Math.max(1,W);
  const rings=[...Ts,...(H||[])];
  return p=>{
    let inT=false;for(const t of Ts)if(ovPointInPoly(t,p)){inT=true;break;}
    if(!inT)return false;
    for(const h of (H||[]))if(ovPointInPoly(h,p))return false;
    for(const r of rings)for(let i=0;i<r.length;i++)if(ovDistSeg(p,r[i],r[(i+1)%r.length])<=shrink)return false;
    return true;
  };
}
/* split a convex CCW polygon by the line through A,B */
function ovSplit(P,A,B){
  const ex=B[0]-A[0],ey=B[1]-A[1];
  const sd=p=>ex*(p[1]-A[1])-ey*(p[0]-A[0]);
  const L=[],R=[];
  for(let j=0;j<P.length;j++){
    const p=P[j],q=P[(j+1)%P.length];
    const dp=sd(p),dq=sd(q);
    if(dp>=0)L.push(p);if(dp<=0)R.push(p);
    if((dp>0&&dq<0)||(dp<0&&dq>0)){const t=dp/(dp-dq);const x=[p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t];L.push(x);R.push(x);}
  }
  return [ovDedup(L),ovDedup(R)];
}
function ovDedup(P){
  const out=[];
  for(const p of P){const q=out[out.length-1];if(!q||Math.abs(p[0]-q[0])+Math.abs(p[1]-q[1])>1e-13)out.push(p);}
  while(out.length>1){const a=out[0],b=out[out.length-1];if(Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])>1e-13)break;out.pop();}
  return out;
}
function ovCentroid(P){
  let a=0,cx=0,cy=0;
  for(let i=0;i<P.length;i++){const p=P[i],q=P[(i+1)%P.length];const c=p[0]*q[1]-q[0]*p[1];a+=c;cx+=(p[0]+q[0])*c;cy+=(p[1]+q[1])*c;}
  if(Math.abs(a)<1e-300){let x=0,y=0;for(const p of P){x+=p[0];y+=p[1];}return [x/P.length,y/P.length];}
  return [cx/(3*a),cy/(3*a)];
}

/* ---------- exact layer model (= core/layer.py class Fold) ---------- */
function buildLayerModel(d,opt){
  opt=opt||{};
  const t0=ovNow();
  const n=d.faces.length,W=d.W;
  const V=d.faces.map(f=>f.V),F=d.faces.map(f=>f.F),s=d.faces.map(f=>f.s);
  let mnx=Infinity,mny=Infinity,mxx=-Infinity,mxy=-Infinity;
  for(const t of F)for(const p of t){mnx=Math.min(mnx,p[0]);mny=Math.min(mny,p[1]);mxx=Math.max(mxx,p[0]);mxy=Math.max(mxy,p[1]);}
  const ext=Math.max(1,mxx-mnx,mxy-mny);          // size of the folded image (= layer.py)
  const eps=1e-7*ext,aeps=1e-13*ext*ext;   // was 1e-9: dropped real overlaps of area ~1e-11 (reviewer A3)
  const Fc=F.map(ovCCW);                         // CCW folded triangles
  const bb=Fc.map(ovBBox);
  // ---- paper adjacency (layer.py _edges) ----
  const q=1e7/Math.max(1,W);
  const key=p=>Math.round(p[0]*q)+','+Math.round(p[1]*q);
  const emap=new Map();
  for(let i=0;i<n;i++)for(let k=0;k<3;k++){
    const ka=key(V[i][k]),kb=key(V[i][(k+1)%3]);
    const e=ka<kb?ka+'|'+kb:kb+'|'+ka;
    if(!emap.has(e))emap.set(e,[]);
    emap.get(e).push([i,k]);
  }
  // degenerate (zero-area) faces from DK are ignored for adjacency: a boundary edge
  // hidden behind a sliver must belong to the real face behind it
  const degen=new Uint8Array(n);
  for(let i=0;i<n;i++)if(ovAbsArea(F[i])<=1e-12*ext*ext||ovAbsArea(V[i])<=1e-12*Math.max(1,W*W))degen[i]=1;
  for(const [kk,lst] of emap){const f=lst.filter(([i])=>!degen[i]);emap.set(kk,f);}
  const edges=[];
  for(const lst of emap.values()){
    if(lst.length!==2)continue;
    const [i,k]=lst[0],j=lst[1][0];
    edges.push({a:i,b:j,kind:s[i]!==s[j]?'fold':'flat',A:F[i][k],B:F[i][(k+1)%3],
                pa:V[i][k],pb:V[i][(k+1)%3]});
  }
  // ---- overlapping pairs (layer.py _overlaps) ----
  const ovPairs=[];const nb=Array.from({length:n},()=>[]);
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
    if(!ovBBHit(bb[i],bb[j],0))continue;
    const c=ovClip(Fc[i],Fc[j]);
    if(c.length>=3&&ovAbsArea(c)>aeps){ovPairs.push([i,j]);nb[i].push(j);nb[j].push(i);}
  }
  const varId=new Int32Array(n*n);              // varId[i*n+j] for i<j
  ovPairs.forEach(([i,j],k)=>{varId[i*n+j]=k+1;});
  const nVars=ovPairs.length;
  const overl=(i,j)=>i<j?varId[i*n+j]>0:varId[j*n+i]>0;
  const above=(i,j)=>i<j?varId[i*n+j]:-varId[j*n+i];   // literal "i above j"

  /* ---- cells ----
     Exact convex refinement of the arrangement: every folded triangle f is cut
     recursively by the supporting lines of the triangle edges of faces that
     overlap f, but a convex piece is only cut when the edge segment actually
     runs through its interior (positive length, eps-robust). The resulting
     convex pieces refine the cells of layer.py's polygonize(all edges); each
     piece's covering set is read off exactly at its centroid. Each region is
     kept once (in the triangle of the lowest-index covering face). Distinct
     covering sets with total area > aeps are the "cells" for clause
     generation, which is all layer.py uses them for. */
  const segOfFace=Fc.map(T=>[[T[0],T[1]],[T[1],T[2]],[T[2],T[0]]]);
  const inTriStrict=(T,p)=>{
    for(let k=0;k<3;k++){const A=T[k],B=T[(k+1)%3];if((B[0]-A[0])*(p[1]-A[1])-(B[1]-A[1])*(p[0]-A[0])<=0)return false;}
    return true;
  };
  const ctol=opt.cutTol||1e-10*Math.max(1,W);   // cut tolerance (pure float noise level)
  const pieces=[];               // {poly, cov, area, c}
  for(let f=0;f<n;f++){
    let cur=[Fc[f]];
    const segs=[];const sk=new Set();
    for(const h of nb[f])for(const sg of segOfFace[h]){
      const k1=key(sg[0])+'|'+key(sg[1]),k2=key(sg[1])+'|'+key(sg[0]);
      if(sk.has(k1)||sk.has(k2))continue;sk.add(k1);
      if(!ovBBHit(bb[f],ovBBox(sg),eps))continue;
      segs.push(sg);
    }
    for(const [A,B] of segs){
      const L=Math.hypot(B[0]-A[0],B[1]-A[1]);if(L<ctol)continue;
      const nxt=[];
      for(const P of cur){
        let mn=Infinity,mx=-Infinity;
        for(const p of P){const dd=((B[0]-A[0])*(p[1]-A[1])-(B[1]-A[1])*(p[0]-A[0]))/L;if(dd<mn)mn=dd;if(dd>mx)mx=dd;}
        if(mn>=-ctol||mx<=ctol){nxt.push(P);continue;}
        if(ovSegInConvex(A,B,P,ctol)<=ctol){nxt.push(P);continue;}
        const [P1,P2]=ovSplit(P,A,B);
        if(P1.length>=3)nxt.push(P1);if(P2.length>=3)nxt.push(P2);
      }
      cur=nxt;
    }
    for(const P of cur){
      const ar=ovAbsArea(P);if(ar<=aeps*1e-3)continue;
      const c=ovCentroid(P);
      const cov=[f];
      let lowest=true;
      for(const h of nb[f])if(inTriStrict(Fc[h],c)){if(h<f){lowest=false;break;}cov.push(h);}
      if(!lowest)continue;
      cov.sort((x,y)=>x-y);
      pieces.push({poly:P,cov,area:ar,c});
    }
  }
  const inT=makeTRegion(d.T,d.holes||[],W);
  const cellMap=new Map();
  for(const p of pieces){
    p.inT=inT(p.c);
    const k=p.cov.join(',');
    let e=cellMap.get(k);
    if(!e){e={cov:p.cov,area:0,inT:false,areaT:0};cellMap.set(k,e);}
    e.area+=p.area;if(p.inT){e.inT=true;e.areaT+=p.area;}
  }
  const cells=[...cellMap.values()].filter(e=>e.area>aeps);
  for(const p of pieces)p.tiny=!(cellMap.get(p.cov.join(',')).area>aeps);   // below layer.py's area threshold
  const tCells=ovNow();

  // ---- cap model: virtual top face D (index n) over T, zipped spurs/bridges ----
  let capInfo=null;const capEdges=[];const TRUEV=nVars+1;
  const ovD=new Uint8Array(n);
  const overlX=(i,j)=>(i===n||j===n)?(ovD[i===n?j:i]===1):overl(i,j);
  const aboveX=(i,j)=>i===n?TRUEV:(j===n?-TRUEV:above(i,j));
  if(opt.cap){
    for(const p of pieces)if(p.inT&&!p.tiny)for(const f of p.cov)ovD[f]=1;
    const CS=capStructure(d,V,F,n,degen,opt.capVariant||0);
    for(const i of CS.dset){const a=CS.atoms[i];capEdges.push({a:a.f,b:n,kind:s[a.f]<0?'fold':'flat',A:a.A,B:a.B,cap:true});}
    for(const [i,j] of CS.zips){const a=CS.atoms[i],b=CS.atoms[j];if(a.f===b.f)continue;
      if(opt.unzipOutside&&capOutside({T:d.T,H:d.holes||[],W:d.W},[(a.A[0]+a.B[0])/2,(a.A[1]+a.B[1])/2]))continue;
      capEdges.push({a:a.f,b:b.f,kind:s[a.f]!==s[b.f]?'fold':'flat',A:a.A,B:a.B,zip:true});}
    capInfo={atoms:CS.atoms.length,zips:CS.zips.length,dAtoms:CS.dset.length,dLen:CS.dLen,notOnDT:CS.notOnDT};
  }
  const allEdges=opt.cap?edges.concat(capEdges):edges;
  // ---- clauses (layer.py clauses) ----
  const cl=[];
  const trip=new Set();
  for(const {cov} of cells){
    const m=cov.length;
    for(let x=0;x<m;x++)for(let y=x+1;y<m;y++)for(let z=y+1;z<m;z++)trip.add(cov[x]*n*n+cov[y]*n+cov[z]);
  }
  for(const t of trip){
    const a=Math.floor(t/(n*n)),b=Math.floor(t/n)%n,c=t%n;
    for(const [x,y,z] of [[a,b,c],[a,c,b]]){
      cl.push([-above(x,y),-above(y,z),-above(z,x)]);
      cl.push([above(x,y),above(y,z),above(z,x)]);
    }
  }
  let ntt=0,nto=0;
  const eq=(l1,l2)=>{cl.push([-l1,l2]);cl.push([l1,-l2]);};
  for(const E of allEdges){
    const {a,b,kind,A,B}=E;
    const sbb=ovBBox([A,B]);
    for(let h=0;h<n;h++){
      if(h===a||h===b)continue;
      if(!ovBBHit(bb[h],sbb,eps))continue;
      if(!(ovSegInConvex(A,B,Fc[h],0.5*eps)>0))continue;   // conservative: every crossing the independent checker sees (was <=10*eps)
      // fold: taco-tortilla (h not between a and b); flat: tortilla-tortilla
      if(overlX(h,a)&&overlX(h,b)){eq(aboveX(h,a),aboveX(h,b));nto++;}
    }
  }
  let nonCollinear=0;
  for(let i1=0;i1<allEdges.length;i1++){
    const E1=allEdges[i1];const b1=ovBBox([E1.A,E1.B]);
    for(let i2=i1+1;i2<allEdges.length;i2++){
      const E2=allEdges[i2];
      if(!ovBBHit(b1,ovBBox([E2.A,E2.B]),eps))continue;
      {const d1=[E1.B[0]-E1.A[0],E1.B[1]-E1.A[1]],d2=[E2.B[0]-E2.A[0],E2.B[1]-E2.A[1]];
       if(Math.abs(d1[0]*d2[1]-d1[1]*d2[0])>1e-7*Math.hypot(...d1)*Math.hypot(...d2))continue;}   // not parallel
      if(ovSegInCapsule(E1.A,E1.B,E2.A,E2.B,eps)<=0.5*eps)continue;   // conservative (was <=10*eps)
      const {a,b}=E1,c=E2.a,dd=E2.b;
      if(new Set([a,b,c,dd]).size<4)continue;
      const k1=E1.kind,k2=E2.kind;
      if(k1==='fold'&&k2==='fold'){
        if(overlX(a,c)&&overlX(a,dd)&&overlX(b,c)&&overlX(b,dd)){
          const lits=[aboveX(a,c),aboveX(b,c),aboveX(a,dd),aboveX(b,dd)];
          for(let m=0;m<16;m++){
            let neg=0;const sg=[];
            for(let k=0;k<4;k++){const sgn=(m>>(3-k))&1?-1:1;if(sgn<0)neg++;sg.push(sgn);}
            if(neg%2===1)cl.push(lits.map((l,k)=>-sg[k]*l));
          }
          ntt++;
        }
      }else if(k1==='fold'||k2==='fold'){
        const [fa,fb,ta,tb]=k1==='fold'?[a,b,c,dd]:[c,dd,a,b];
        for(const h of [ta,tb])if(overlX(h,fa)&&overlX(h,fb)){eq(aboveX(h,fa),aboveX(h,fb));nto++;}
      }else{
        for(const [p,q_,r,t] of [[a,b,c,dd],[a,b,dd,c]])
          if(overlX(p,r)&&overlX(q_,t))eq(aboveX(p,r),aboveX(q_,t));
      }
    }
  }
  let nStrong=0;
  if(opt.cap){
    cl.push([TRUEV]);
    // strong cap: the face owning a raw edge on dT is the top face of every piece touching that edge
    if(!opt.capWeak)for(const E of capEdges){
      if(!E.cap)continue;
      const L=Math.hypot(E.B[0]-E.A[0],E.B[1]-E.A[1]);if(L<=10*eps)continue;
      const sbb=ovBBox([E.A,E.B]);
      for(const p of pieces){
        if(p.tiny||p.cov.length<2||p.cov.indexOf(E.a)<0)continue;
        if(!ovBBHit(ovBBox(p.poly),sbb,eps))continue;
        let touch=0;
        for(let k=0;k<p.poly.length;k++){
          const P0=p.poly[k],P1=p.poly[(k+1)%p.poly.length];
          if(ovDistSeg(P0,E.A,E.B)<=10*eps&&ovDistSeg(P1,E.A,E.B)<=10*eps)touch+=Math.hypot(P1[0]-P0[0],P1[1]-P0[1]);
        }
        if(touch<=10*eps)continue;
        for(const h of p.cov)if(h!==E.a){cl.push([above(E.a,h)]);nStrong++;}
      }
    }
  }
  const nBase=cl.length;
  // ---- inside-out visibility ----
  let visCells=0,visImpossible=0;
  if((opt.cap&&opt.unzipOutside)||opt.visBoth){
    // explicit visibility: back on top inside T, front on top outside T
    for(const p of pieces){
      if(p.tiny)continue;
      const inside=p.inT, outside=!inside&&capOutside({T:d.T,H:d.holes||[],W:d.W},p.c)&&(!opt.hullOnly||ovPointInPoly(opt.hullOnly,p.c));
      if(!inside&&!outside)continue;
      const cov=p.cov;
      const bad=cov.filter(f=>inside?s[f]>0:s[f]<0);
      if(bad.length===cov.length){cl.push([]);continue;}
      for(const f of bad)cl.push(cov.filter(h=>h!==f).map(h=>above(h,f)));
    }
  }
  if(!opt.noVisibility&&!opt.cap&&!opt.visBoth){
    for(const {cov,inT} of cells){
      if(!inT)continue;
      visCells++;
      if(!cov.some(f=>s[f]<0))visImpossible++;
      for(const f of cov)if(s[f]>0)cl.push(cov.filter(h=>h!==f).map(h=>above(h,f)));
    }
  }
  return {n,W,eps,aeps,V,F,Fc,s,edges,capEdges,capInfo,nStrong,nVarsSolver:opt.cap?nVars+1:nVars,ovPairs,nVars,varId,overl,above,pieces,cells,clauses:cl,
          nBase,info:{vars:nVars,clauses:cl.length,triples:trip.size,taco_taco:ntt,taco_tortilla:nto,
          cells:cells.length,pieces:pieces.length,vis_cells:visCells,vis_impossible:visImpossible,
          ms_cells:tCells-t0,ms_build:ovNow()-t0}};
}

/* assignment (Int8Array 1..nVars, 1/-1) -> P matrix  (P[i*n+j]=1 iff i above j) */
function orderMatrix(model,M){
  const {n,ovPairs}=M;const P=new Uint8Array(n*n);
  ovPairs.forEach(([i,j],k)=>{if(model[k+1]>0)P[i*n+j]=1;else P[j*n+i]=1;});
  return P;
}
function modelFromP(P,M){
  const m=new Int8Array((M.nVarsSolver||M.nVars)+1);
  M.ovPairs.forEach(([i,j],k)=>{m[k+1]=P[i*M.n+j]?1:-1;});
  if(M.nVarsSolver>M.nVars)m[M.nVarsSolver]=1;
  return m;
}
function countViolated(clauses,model){
  let bad=0;
  for(const c of clauses){let ok=false;for(const l of c){if((l>0&&model[l]>0)||(l<0&&model[-l]<0)){ok=true;break;}}if(!ok)bad++;}
  return bad;
}
/* independent check (layer.py Fold.check): per-cell total order, top colour inside T */
function checkOrder(M,P){
  const {n,s}=M;
  let notTotal=0,maxL=0,topFront=0,Tarea=0,outArea=0,outBack=0;
  let tiny=0;
  for(const p of M.pieces){
    const cov=p.cov;
    const sc=cov.map(f=>cov.reduce((t,g)=>t+P[f*n+g],0));
    let top=cov[0],best=-1;
    cov.forEach((f,k)=>{if(sc[k]>best){best=sc[k];top=f;}});
    p.top=top;
    if(p.tiny){tiny++;continue;}           // excluded exactly like layer.py's area filter
    maxL=Math.max(maxL,cov.length);
    const srt=[...sc].sort((a,b)=>a-b);
    if(srt.some((v,k)=>v!==k))notTotal++;
    if(p.inT){Tarea+=p.area;if(s[top]>0)topFront+=p.area;}
    else if(capOutside(M,p.c)){outArea+=p.area;if(s[top]<0)outBack+=p.area;}
  }
  // area of T itself (to detect parts of T not covered by paper)
  let At=0;for(const t of M.T||[])At+=ovAbsArea(t);for(const h of M.H||[])At-=ovAbsArea(h);
  return {not_total:notTotal,max_layers:maxL,back_on_top:Tarea?1-topFront/Tarea:null,T_area_cells:Tarea,T_area:At,tiny_pieces:tiny,out_area:outArea,back_out:outBack};
}
/* M/V from the order (mv.py): valley iff the upper face is back-up (s<0), seen from the front */
function mvFromOrder(M,P){
  const out=[];
  for(const e of M.edges){
    if(e.kind!=='fold')continue;
    const top=P[e.a*M.n+e.b]?e.a:e.b;
    out.push({a:e.pa,b:e.pb,f0:e.a,f1:e.b,mv:M.s[top]<0?'V':'M',A:e.A,B:e.B});
  }
  return out;
}
function maekawa(M,creases){
  const W=M.W,q=1e7/Math.max(1,W);
  const k=p=>Math.round(p[0]*q)+','+Math.round(p[1]*q);
  const inc=new Map();
  for(const c of creases)for(const v of [c.a,c.b]){
    const kk=k(v);if(!inc.has(kk))inc.set(kk,{p:v,M:0,V:0});
    inc.get(kk)[c.mv]++;
  }
  let tot=0,bad=0;const badPts=[];
  const paper=M.paper||[[0,0],[W,0],[W,W],[0,W]];
  for(const e of inc.values()){
    let dmin=Infinity;for(let i=0;i<paper.length;i++)dmin=Math.min(dmin,ovDistSeg(e.p,paper[i],paper[(i+1)%paper.length]));
    if(dmin<1e-6*W)continue;           // vertex on the paper boundary
    tot++;if(Math.abs(e.M-e.V)!==2){bad++;badPts.push(e.p);}
  }
  return {interior:tot,bad,badPts};
}

/* ---------- full pipeline ---------- */
function solveShape(Ts,H,opt){
  opt=opt||{};
  if(opt.paper==='auto'){
    const logs=[];let tried=0;const t0=ovNow();
    const nComp=Ts.length+(H||[]).length;
    const plan=[['square',1,0],['legacy',1,0],['square',1.25,0],['square',1.6,0]];
    if(nComp>1)plan.splice(2,0,['square',1,1],['legacy',1,1]);
    /* appended last, so shapes solved by the earlier settings are unaffected: larger paper
       and the second bridge mode solve 4 of the 5 run7 failures (a2/baguniv/retry) */
    plan.push(['square',1.2,1],['square',1.8,1],['square',2,0]);
    for(const [k,sc,bm] of plan){
      setBridgeMode(bm);
      const r=solveShape(Ts,H,Object.assign({},opt,{paper:k,wScale:sc}));
      setBridgeMode(0);
      tried+=r.tried;logs.push(...r.log);
      if(r.ok){r.tried=tried;r.log=logs;r.paperKindUsed=k;r.ms=ovNow()-t0;return r;}
    }
    return {ok:false,log:logs,tried,ms:ovNow()-t0};
  }
  const kind=opt.paper||'square';
  const maxC=opt.maxCandidates||(kind==='legacy'?40:20);
  let gen=kind==='legacy'?candidates(Ts,H,maxC):candidatesConvex(Ts,H,kind,maxC,opt.wScale||1);
  if(opt.foldIn&&opt.rankByFoldIn!==false&&typeof fiProtrusion==='function'){
    /* order candidates by protrusion after fold-in (geometry only; paper §9) */
    const all=[...gen];
    for(const c of all){try{c.protrusion=fiProtrusion(c,Ts,H);}catch(e){c.protrusion=Infinity;}}
    all.sort((a,b)=>a.protrusion-b.protrusion);
    gen=all;
  }
  const onProgress=opt.onProgress||(()=>{});
  const t0=ovNow();const log=[];
  for(const cand of gen){
    const tc=ovNow();
    let M,res;
    for(let cv=0;cv<(opt.cap?(opt.capVariants||6):1);cv++){
      M=buildLayerModel(cand,{cap:!!opt.cap,capVariant:cv});
      M.T=Ts;M.H=H||[];M.paper=cand.paper;
      // boundary matching is part of the definition: a pairing that leaves paper-boundary
      // pieces off dT is not a candidate (reviewer A3; previously only counted, not enforced)
      if(opt.cap&&M.capInfo&&M.capInfo.notOnDT>0)res={status:'not-bm',stats:{},reason:'boundary pieces off dT'};
      else if(M.info.vis_impossible>0||M.clauses.some(c=>c.length===0))res={status:'unsat',stats:{},reason:'trivial'};
      else res=satSolve(M.nVarsSolver,M.clauses,{timeLimitMs:opt.satTimeMs||60000});
      if(res.status==='sat'){M.capVariant=cv;break;}
      if(cv===0&&M.capInfo&&M.capInfo.zips===0)break;
    }
    const entry={k:cand.index,protrusion:cand.protrusion,phase:cand.phase,seed:cand.seed,n:M.n,vars:M.nVars,clauses:M.clauses.length,
                 status:res.status,conflicts:res.stats.conflicts||0,ms_build:M.info.ms_build,ms:ovNow()-tc};
    log.push(entry);onProgress(entry);
    if(res.status!=='sat')continue;
    const P=orderMatrix(res.model,M);
    const viol=countViolated(M.clauses,res.model);
    const ck=checkOrder(M,P);
    // independent visibility check: reject numerically doubtful solutions (thin slivers at dT)
    if(opt.cap&&(viol>0||ck.not_total>0||!(ck.back_on_top>=1-1e-12)||ck.back_out>0)){entry.status='rejected-check';
      if(opt.onRejected)opt.onRejected({model:M,P,check:ck,violated:viol,cand});continue;}
    const creases=mvFromOrder(M,P);
    const mk=maekawa(M,creases);
    const out={ok:true,cand,model:M,P,creases,check:ck,maekawa:mk,violated:viol,log,tried:log.length,ms:ovNow()-t0};
    if(opt.foldIn&&typeof foldInCertified==='function'){
      const tf=ovNow();
      const g=foldInCertified(out,Ts,H,{cap:!!opt.cap});
      const fin={rounds:g.rounds,accepted:g.accepted,rejected:g.rejected,ok:g.ok,violated:g.violated,ms:ovNow()-tf,maxLayersBefore:ck.max_layers};
      if(g.ok){Object.assign(out,{cand:g.cand,model:g.model,P:g.P,creases:g.creases,check:g.check,maekawa:g.maekawa,violated:g.violated});}
      out.foldin=fin;out.ms=ovNow()-t0;
    }
    return out;
  }
  return {ok:false,log,tried:log.length,ms:ovNow()-t0};
}

/* point strictly outside T (by more than 1e-6*W) */
function capOutside(M,p){
  const Ts=M.T||[],H=M.H||[];const sh=1e-6*Math.max(1,M.W);
  let inT=false;for(const t of Ts)if(ovPointInPoly(t,p)){inT=true;break;}
  if(inT){let inH=false;for(const h of H)if(ovPointInPoly(h,p))inH=true;if(!inH)return false;}
  for(const r of [...Ts,...H])for(let i=0;i<r.length;i++)if(ovDistSeg(p,r[i],r[(i+1)%r.length])<=sh)return false;
  return true;
}
