/* ---- Strip method (paper_v6 §5b–5d): lem:bands → rows → strip state Φ (explicit order, no SAT)
        → closing pleats (lem:pleat, reverse order) → accordion square (lem:accordion).            ---- */
const OVStrip=(function(){
"use strict";
/* ---------- basic geometry ---------- */
const V={
  add:(a,b)=>[a[0]+b[0],a[1]+b[1]], sub:(a,b)=>[a[0]-b[0],a[1]-b[1]], mul:(a,s)=>[a[0]*s,a[1]*s],
  dot:(a,b)=>a[0]*b[0]+a[1]*b[1], cr:(a,b)=>a[0]*b[1]-a[1]*b[0], len:a=>Math.hypot(a[0],a[1]),
  nrm:a=>{const l=Math.hypot(a[0],a[1]);return [a[0]/l,a[1]/l];}, perp:a=>[-a[1],a[0]],
  dist:(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]), rot:(a,t)=>[a[0]*Math.cos(t)-a[1]*Math.sin(t),a[0]*Math.sin(t)+a[1]*Math.cos(t)]
};
// isometry x' = a x + b y + e, y' = c x + d y + f
const I={
  id:()=>({a:1,b:0,c:0,d:1,e:0,f:0}),
  ap:(g,p)=>[g.a*p[0]+g.b*p[1]+g.e,g.c*p[0]+g.d*p[1]+g.f],
  lin:(g,p)=>[g.a*p[0]+g.b*p[1],g.c*p[0]+g.d*p[1]],
  // comp(g,h) = g ∘ h (h first)
  comp:(g,h)=>({a:g.a*h.a+g.b*h.c,b:g.a*h.b+g.b*h.d,c:g.c*h.a+g.d*h.c,d:g.c*h.b+g.d*h.d,
    e:g.a*h.e+g.b*h.f+g.e,f:g.c*h.e+g.d*h.f+g.f}),
  inv:g=>{const det=g.a*g.d-g.b*g.c;const a=g.d/det,b=-g.b/det,c=-g.c/det,d=g.a/det;return {a,b,c,d,e:-(a*g.e+b*g.f),f:-(c*g.e+d*g.f)};},
  det:g=>g.a*g.d-g.b*g.c,
  tr:(v)=>({a:1,b:0,c:0,d:1,e:v[0],f:v[1]}),
  refl:(p,q)=>{const u=V.nrm(V.sub(q,p));const a=2*u[0]*u[0]-1,b=2*u[0]*u[1],d=2*u[1]*u[1]-1;
    return {a,b,c:b,d,e:p[0]-(a*p[0]+b*p[1]),f:p[1]-(b*p[0]+d*p[1])};},
  rot:(c,t)=>{const co=Math.cos(t),si=Math.sin(t);return {a:co,b:-si,c:si,d:co,e:c[0]-(co*c[0]-si*c[1]),f:c[1]-(si*c[0]+co*c[1])};},
  lin2:(a,b,c,d)=>({a,b,c,d,e:0,f:0})
};
function area(P){let s=0;for(let i=0,n=P.length;i<n;i++){const p=P[i],q=P[(i+1)%n];s+=p[0]*q[1]-q[0]*p[1];}return s/2;}
function ccw(P){return area(P)<0?P.slice().reverse():P;}
function centroid(P){let x=0,y=0;for(const p of P){x+=p[0];y+=p[1];}return [x/P.length,y/P.length];}
// keep dot(n,p) <= c
function clipHP(P,n,c,eps){eps=eps||0;const out=[];const m=P.length;if(!m)return out;
  for(let i=0;i<m;i++){const p=P[i],q=P[(i+1)%m];const sp=n[0]*p[0]+n[1]*p[1]-c,sq=n[0]*q[0]+n[1]*q[1]-c;
    if(sp<=eps)out.push(p);
    if((sp<-eps&&sq>eps)||(sp>eps&&sq<-eps)){const t=sp/(sp-sq);out.push([p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])]);}}
  return dedup(out);}
function dedup(P){const out=[];for(const q of P){const l=out[out.length-1];if(l&&Math.abs(l[0]-q[0])+Math.abs(l[1]-q[1])<1e-11*(1+Math.abs(q[0])+Math.abs(q[1])))continue;out.push(q);}
  while(out.length>1){const a=out[0],b=out[out.length-1];if(Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])<1e-11*(1+Math.abs(a[0])+Math.abs(a[1])))out.pop();else break;}
  return out.length>=3?out:[];}
function clipConvex(P,C){ // P ∩ C (C convex CCW)
  let R=P;for(let i=0;i<C.length&&R.length;i++){const a=C[i],b=C[(i+1)%C.length];const n=[b[1]-a[1],-(b[0]-a[0])];const L=Math.hypot(n[0],n[1]);if(L<1e-14)continue;R=clipHP(R,[n[0]/L,n[1]/L],(n[0]*a[0]+n[1]*a[1])/L,1e-10);}
  return R;}
function interArea(P,Q){const R=clipConvex(P,Q);return R.length?Math.abs(area(R)):0;}
function bbox(P){let a=Infinity,b=Infinity,c=-Infinity,d=-Infinity;for(const p of P){if(p[0]<a)a=p[0];if(p[1]<b)b=p[1];if(p[0]>c)c=p[0];if(p[1]>d)d=p[1];}return [a,b,c,d];}
function hull(pts){const P=pts.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]);if(P.length<3)return P;
  const cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);const lo=[],up=[];
  for(const p of P){while(lo.length>=2&&cr(lo[lo.length-2],lo[lo.length-1],p)<=1e-12)lo.pop();lo.push(p);}
  for(let i=P.length-1;i>=0;i--){const p=P[i];while(up.length>=2&&cr(up[up.length-2],up[up.length-1],p)<=1e-12)up.pop();up.push(p);}
  up.pop();lo.pop();return lo.concat(up);}
function cleanPoly(P,tol){ // remove near-duplicate and collinear vertices of a convex polygon
  let Q=P.slice();let ch=true;
  while(ch&&Q.length>3){ch=false;
    for(let i=0;i<Q.length;i++){const a=Q[(i+Q.length-1)%Q.length],b=Q[i],c=Q[(i+1)%Q.length];
      const L=V.dist(a,c);if(V.dist(a,b)<tol||Math.abs(V.cr(V.sub(b,a),V.sub(c,a)))/Math.max(L,1e-300)<tol){Q.splice(i,1);ch=true;break;}}}
  return Q;}
function segPolyDist(a,b,P){ // distance from segment ab to convex polygon P (0 if intersecting)
  if(segHitsConvex(a,b,P,0))return 0;let d=Infinity;
  for(let i=0;i<P.length;i++){const p=P[i],q=P[(i+1)%P.length];d=Math.min(d,segSeg(a,b,p,q));}return d;}
function ptSeg(p,a,b){const v=V.sub(b,a),L2=V.dot(v,v);let t=L2?V.dot(V.sub(p,a),v)/L2:0;t=Math.max(0,Math.min(1,t));return V.dist(p,[a[0]+t*v[0],a[1]+t*v[1]]);}
function segSeg(a,b,c,d){const o=(p,q,r)=>V.cr(V.sub(q,p),V.sub(r,p));
  if(o(a,b,c)*o(a,b,d)<0&&o(c,d,a)*o(c,d,b)<0)return 0;return Math.min(ptSeg(a,c,d),ptSeg(b,c,d),ptSeg(c,a,b),ptSeg(d,a,b));}
// does segment ab pass through the interior of convex CCW polygon P by more than tol (length)?
function segHitsConvex(a,b,P,tol){let t0=0,t1=1;const d=V.sub(b,a);
  for(let i=0;i<P.length;i++){const p=P[i],q=P[(i+1)%P.length];const n=[q[1]-p[1],-(q[0]-p[0])];const L=V.len(n);
    const num=(V.dot(n,p)-V.dot(n,a))/L-1e-9, den=V.dot(n,d)/L; // inside: dot(n,x) < dot(n,p)
    if(Math.abs(den)<1e-15){if(num<0)return false;continue;}
    const t=num/den;if(den>0){if(t<t1)t1=t;}else{if(t>t0)t0=t;}if(t0>=t1)return false;}
  return (t1-t0)*V.len(d)>(tol||0);}
function mulberry(seed){let s=seed>>>0;return ()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}

/* =====================================================================================
   lem:bands  (with translation tracking)
   The region is kept as a set of convex cells with recorded adjacency (shared segments).
   ===================================================================================== */
function ringsOf(T,holes){ // normalise: outer CCW, holes CW
  const R=[];for(const r of T)R.push({pts:ccw(r.map(p=>[p[0],p[1]])),hole:false});
  for(const r of (holes||[]))R.push({pts:ccw(r.map(p=>[p[0],p[1]])).reverse(),hole:true});return R;}
function edgesOf(R){const E=[];for(const r of R){const n=r.pts.length;for(let i=0;i<n;i++)E.push({a:r.pts[i],b:r.pts[(i+1)%n],id:E.length});}
  for(const e of E){e.len=V.dist(e.a,e.b);}return E;}

function slabCells(E){ // trapezoidal decomposition by horizontal lines through all vertices
  const ys=[...new Set(E.map(e=>e.a[1]))].sort((a,b)=>a-b);
  const cells=[],adj=[];let prevTop=[];
  for(let j=0;j+1<ys.length;j++){const y0=ys[j],y1=ys[j+1],ym=(y0+y1)/2;
    const cr=[];for(const e of E){const lo=Math.min(e.a[1],e.b[1]),hi=Math.max(e.a[1],e.b[1]);if(lo<=y0&&hi>=y1){
      const xat=y=>e.a[0]+(e.b[0]-e.a[0])*(y-e.a[1])/(e.b[1]-e.a[1]);cr.push({e,x:xat(ym),x0:xat(y0),x1:xat(y1)});}}
    cr.sort((a,b)=>a.x-b.x);const top=[];
    for(let k=0;k+1<cr.length;k+=2){const L=cr[k],Rr=cr[k+1];
      let P=[[L.x0,y0],[Rr.x0,y0],[Rr.x1,y1],[L.x1,y1]],tg=[-1,Rr.e.id,-1,L.e.id];
      // drop zero-length edges
      const P2=[],t2=[];for(let i=0;i<4;i++){if(V.dist(P[i],P[(i+1)%4])>1e-12){P2.push(P[i]);t2.push(tg[i]);}}
      const id=cells.length;cells.push({poly:P2,tags:t2,shift:[0,0]});
      // adjacency with the slab below at y0
      for(const q of prevTop){const lo=Math.max(q.x0,L.x0),hi=Math.min(q.x1,Rr.x0);if(hi-lo>1e-12)adj.push({a:q.id,b:id,s:[[lo,y0],[hi,y0]]});}
      top.push({id,x0:L.x1,x1:Rr.x1});}
    prevTop=top;}
  return {cells,adj};}

class Config{
  constructor(T,holes){this.R=ringsOf(T,holes);this.E=edgesOf(this.R);const s=slabCells(this.E);this.cells=s.cells;this.adj=s.adj;
    this.openings=[];this.markers=[];for(const r of this.R)for(const p of r.pts)this.markers.push([p[0],p[1]]);}
  // channel-only opening along the line through p with direction d, width w (H+ = left of d moves by 2w n)
  open(p,d,w,tagFn){
    d=V.nrm(d);const n=[-d[1],d[0]];const c0=V.dot(n,p);const tv=V.mul(n,2*w);const eps=1e-11;
    const f=x=>V.dot(n,x)-c0;
    let any=0,mov=0;for(const C of this.cells){let lo=Infinity,hi=-Infinity;for(const q of C.poly){const v=f(q);if(v<lo)lo=v;if(v>hi)hi=v;}
      if(lo<-eps&&hi>eps)any=1;else if(lo>=-eps)mov++;}
    if(!any&&(mov===0||mov===this.cells.length))return false; // nothing happens
    // wall endpoints: intervals of the line inside the region
    const ivs=[];
    for(const C of this.cells){const P=C.poly;let ts=[];for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length];const fa=f(a),fb=f(b);
        if(Math.abs(fa)<=eps)ts.push(V.dot(d,a));if((fa<-eps&&fb>eps)||(fa>eps&&fb<-eps)){const t=fa/(fa-fb);ts.push(V.dot(d,[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]));}}
      if(ts.length>=2){const lo=Math.min(...ts),hi=Math.max(...ts);if(hi-lo>1e-10)ivs.push([lo,hi]);}}
    ivs.sort((a,b)=>a[0]-b[0]);const mer=[];for(const iv of ivs){if(mer.length&&iv[0]<=mer[mer.length-1][1]+1e-9)mer[mer.length-1][1]=Math.max(mer[mer.length-1][1],iv[1]);else mer.push(iv.slice());}
    const base=V.sub(p,V.mul(d,V.dot(d,p)));const newM=[];
    for(const iv of mer)for(const t of iv){const q=V.add(base,V.mul(d,t));newM.push(q,V.add(q,tv));}
    // markers
    const M2=[];for(const q of this.markers){const v=f(q);if(v<-1e-9)M2.push(q);else if(v>1e-9)M2.push(V.add(q,tv));else M2.push(q,V.add(q,tv));}
    this.markers=M2.concat(newM);
    // cells
    const minus=new Array(this.cells.length).fill(-1),plus=new Array(this.cells.length).fill(-1);const NC=[];
    for(let k=0;k<this.cells.length;k++){const C=this.cells[k];
      for(const sg of [-1,1]){
        // clip keeping sg*f<=0, tag the new edge -1
        const P=C.poly,tg=C.tags,m=P.length;const out=[],ot=[];
        for(let i=0;i<m;i++){const a=P[i],b=P[(i+1)%m];const fa=-sg*f(a),fb=-sg*f(b);
          if(fa<=eps){out.push(a);ot.push(fb<=eps?tg[i]:tg[i]);}
          if((fa<-eps&&fb>eps)||(fa>eps&&fb<-eps)){const t=fa/(fa-fb);out.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);ot.push(fa<-eps?-1:tg[i]);}}
        // fix tags: edge i goes out[i]->out[i+1]; recompute: an edge lying on the line gets -1
        if(out.length<3)continue;const A=Math.abs(area(out));if(A<1e-14)continue;
        const tags=[];for(let i=0;i<out.length;i++){const a=out[i],b=out[(i+1)%out.length];
          if(Math.abs(f(a))<=eps&&Math.abs(f(b))<=eps)tags.push(-1);else{ // find original edge containing midpoint
            const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];let t=-1;for(let j=0;j<m;j++){const u=P[j],v=P[(j+1)%m];if(ptSeg(mid,u,v)<1e-9){t=tg[j];break;}}tags.push(t);}}
        const cell={poly:sg>0?out.map(q=>V.add(q,tv)):out,tags,shift:sg>0?V.add(C.shift,tv):C.shift.slice()};
        for(const key of ['band','trap','shift0'])if(C[key]!==undefined)cell[key]=C[key];
        if(sg<0)minus[k]=NC.length;else plus[k]=NC.length;NC.push(cell);}}
    const NA=[];
    for(const A of this.adj){const [p0,p1]=A.s;const f0=f(p0),f1=f(p1);
      if(Math.abs(f0)<=1e-9&&Math.abs(f1)<=1e-9)continue;
      const parts=[];
      const cut=(fa,fb)=>fa/(fa-fb);
      // minus part
      {let a=p0,b=p1;if(f0>1e-12&&f1>1e-12){}else{if(f0>1e-12){const t=cut(f0,f1);a=[p0[0]+t*(p1[0]-p0[0]),p0[1]+t*(p1[1]-p0[1])];}
        if(f1>1e-12){const t=cut(f0,f1);b=[p0[0]+t*(p1[0]-p0[0]),p0[1]+t*(p1[1]-p0[1])];}
        if(V.dist(a,b)>1e-10&&minus[A.a]>=0&&minus[A.b]>=0)NA.push({a:minus[A.a],b:minus[A.b],s:[a,b]});}}
      {let a=p0,b=p1;if(f0<-1e-12&&f1<-1e-12){}else{if(f0<-1e-12){const t=cut(f0,f1);a=[p0[0]+t*(p1[0]-p0[0]),p0[1]+t*(p1[1]-p0[1])];}
        if(f1<-1e-12){const t=cut(f0,f1);b=[p0[0]+t*(p1[0]-p0[0]),p0[1]+t*(p1[1]-p0[1])];}
        if(V.dist(a,b)>1e-10&&plus[A.a]>=0&&plus[A.b]>=0)NA.push({a:plus[A.a],b:plus[A.b],s:[V.add(a,tv),V.add(b,tv)]});}}}
    this.cells=NC;this.adj=NA;this.openings.push({p:[p[0],p[1]],d,w});
    return true;}
  comps(){const n=this.cells.length,par=[...Array(n).keys()];const fd=x=>{while(par[x]!==x){par[x]=par[par[x]];x=par[x];}return x;};
    for(const A of this.adj){const a=fd(A.a),b=fd(A.b);if(a!==b)par[a]=b;}
    const m=new Map();for(let i=0;i<n;i++){const r=fd(i);if(!m.has(r))m.set(r,[]);m.get(r).push(i);}return [...m.values()];}
  compTags(cs){const s=new Set();for(const i of cs){const C=this.cells[i];for(let j=0;j<C.tags.length;j++)if(C.tags[j]>=0&&V.dist(C.poly[j],C.poly[(j+1)%C.poly.length])>1e-9)s.add(C.tags[j]);}return s;}
}

function segClosest(a,b,c,d){ // closest points of two disjoint segments (sampled exact enough)
  const cands=[];const proj=(p,u,v)=>{const w=V.sub(v,u),L2=V.dot(w,w);let t=V.dot(V.sub(p,u),w)/L2;t=Math.max(0,Math.min(1,t));return V.add(u,V.mul(w,t));};
  cands.push([a,proj(a,c,d)],[b,proj(b,c,d)],[proj(c,a,b),c],[proj(d,a,b),d]);
  let best=null,bd=Infinity;for(const [p,q] of cands){const dd=V.dist(p,q);if(dd<bd){bd=dd;best=[p,q];}}return best;}

// lem:bands.  Returns {cfg, pieces, info}
function bands(T,holes,opt){
  opt=opt||{};const rnd=mulberry(opt.seed||1);const w=opt.w;
  const cfg=new Config(T,holes);const E=cfg.E;const allV=E.map(e=>e.a);
  const info={step0:0,step0pairs:0,stepi:0,stepii:0,stepiiSkipped:0,log:[]};
  const dirs=E.map(e=>V.nrm(V.sub(e.b,e.a))).concat([[1,0]]);
  const minAng=d=>Math.min(...dirs.map(u=>Math.abs(V.cr(u,d))));
  const genericOK=(p,d)=>{const n=[-d[1],d[0]];for(const q of allV){const dd=Math.abs(V.dot(n,V.sub(q,p)));if(dd>1e-12&&dd<1e-6)return false;}
    for(const e of E){const u=V.nrm(V.sub(e.b,e.a));if(Math.abs(V.cr(u,d))<1e-4)return false;}return true;};
  // ---- (0) one opening line per pair of original edges (per component containing both, see report)
  const pairs=[];for(let i=0;i<E.length;i++)for(let j=i+1;j<E.length;j++){const e=E[i],f=E[j];
    const sh=V.dist(e.a,f.a)<1e-12?e.a:V.dist(e.a,f.b)<1e-12?e.a:V.dist(e.b,f.a)<1e-12?e.b:V.dist(e.b,f.b)<1e-12?e.b:null;
    pairs.push({i,j,v:sh});}
  pairs.sort((a,b)=>(a.v?0:1)-(b.v?0:1));
  for(const pr of pairs){const e=E[pr.i],f=E[pr.j];let line=null;
    if(pr.v){const v=pr.v;const u1=V.nrm(V.sub(V.dist(e.a,v)<1e-12?e.b:e.a,v)),u2=V.nrm(V.sub(V.dist(f.a,v)<1e-12?f.b:f.a,v));
      let b=V.add(u1,u2);if(V.len(b)<1e-9)b=V.perp(u1);b=V.nrm(b);
      // generic direction separating u1,u2, as far as possible from every edge direction and from horizontal
      let bs=-1;for(let k=0;k<360;k++){const d=[Math.cos(k*Math.PI/360+rnd()*1e-3),Math.sin(k*Math.PI/360+rnd()*1e-3)];
        if(!(V.cr(d,u1)*V.cr(d,u2)<0)||!genericOK(v,d))continue;const sc=minAng(d)*(opt.randLines?(0.6+0.4*rnd()):1);if(sc>bs){bs=sc;line={p:v,d,rel:true};}}
      if(!line)line={p:v,d:b,rel:true};}
    else{let cand=[],mx=0;
      for(let k=0;k<360;k++){const th=k*Math.PI/360+rnd()*1e-3;const d=[Math.cos(th),Math.sin(th)];const n=[-d[1],d[0]];
        const s1=[e.a,e.b].map(x=>V.dot(n,x)),s2=[f.a,f.b].map(x=>V.dot(n,x));let gap=-1,c=0;
        if(Math.max(...s1)<Math.min(...s2)){gap=Math.min(...s2)-Math.max(...s1);c=(Math.min(...s2)+Math.max(...s1))/2;}
        else if(Math.max(...s2)<Math.min(...s1)){gap=Math.min(...s1)-Math.max(...s2);c=(Math.min(...s1)+Math.max(...s2))/2;}
        if(gap<=0)continue;mx=Math.max(mx,gap);cand.push({d,p:V.mul(n,c),gap});}
      let bs=-1;for(const C of cand){if(C.gap<0.3*mx||!genericOK(C.p,C.d))continue;const sc=minAng(C.d)*(opt.randLines?(0.6+0.4*rnd()):1);if(sc>bs){bs=sc;line={p:C.p,d:C.d};}}
      if(!line){const [p,q]=segClosest(e.a,e.b,f.a,f.b);line={p:V.mul(V.add(p,q),0.5),d:V.perp(V.nrm(V.sub(q,p)))};}}
    let guard=0,did=false;
    while(guard++<50){const cs=cfg.comps();let tgt=null;for(const c of cs){const s=cfg.compTags(c);if(s.has(pr.i)&&s.has(pr.j)){tgt=c;break;}}
      if(!tgt)break;const sh=cfg.cells[tgt[0]].shift;
      if(cfg.open(V.add(line.p,sh),line.d,w))info.step0++;did=true;}
    if(did)info.step0pairs++;}
  // (0) alone already gives convex pieces with <=1 owned edge (thm:channel (b) at every vertex); (i)(ii) optional
  if(opt.skipI){const pieces=finalPieces(cfg);return {cfg,pieces,info};}
  // ---- (i) horizontal openings through all vertices, top to bottom
  for(const C of cfg.cells)C.shift0=C.shift.slice();
  let hs=[...cfg.markers.map(m=>m[1])].sort((a,b)=>b-a);const H=[];for(const y of hs){if(!H.length||H[H.length-1]-y>1e-9)H.push(y);}
  for(const y of H){if(cfg.open([0,y],[1,0],w))info.stepi++;}
  // band labels: index by pre-(i) height
  const Hasc=H.slice().sort((a,b)=>a-b);
  for(const C of cfg.cells){const ym=centroid(C.poly)[1]-(C.shift[1]-C.shift0[1]);let k=0;while(k<Hasc.length&&Hasc[k]<ym)k++;C.band=k;}
  {const cs=cfg.comps();cs.forEach((c,k)=>{for(const i of c)cfg.cells[i].trap=k;});}
  // ---- (ii) separate neighbouring pieces within a band (only pairs closer than 2w, see report)
  const bandsIds=[...new Set(cfg.cells.map(C=>C.band))];
  for(const bj of bandsIds){
    const trapsOf=()=>{const m=new Map();cfg.cells.forEach((C,i)=>{if(C.band===bj){if(!m.has(C.trap))m.set(C.trap,[]);m.get(C.trap).push(i);}});return m;};
    let m0=trapsOf();const order=[...m0.keys()].sort((a,b)=>{const xa=Math.min(...m0.get(a).flatMap(i=>cfg.cells[i].poly.map(p=>p[0]-cfg.cells[i].shift[0])));
      const xb=Math.min(...m0.get(b).flatMap(i=>cfg.cells[i].poly.map(p=>p[0]-cfg.cells[i].shift[0])));return xa-xb;});
    for(let k=0;k+1<order.length;k++){const m=trapsOf();const A=m.get(order[k]),B=m.get(order[k+1]);if(!A||!B)continue;
      const hA=hull(A.flatMap(i=>cfg.cells[i].poly)),hB=hull(B.flatMap(i=>cfg.cells[i].poly));
      let dmin=Infinity;for(let i=0;i<hA.length;i++)dmin=Math.min(dmin,segPolyDist(hA[i],hA[(i+1)%hA.length],hB));
      if(dmin>=2*w*(1-1e-9)&&!opt.allPairsII){info.stepiiSkipped++;continue;}
      // max-margin steep separating line between hA and hB, not cutting other traps of the band
      const others=[...m.keys()].filter(t=>t!==order[k]&&t!==order[k+1]).map(t=>hull(m.get(t).flatMap(i=>cfg.cells[i].poly)));
      let best=null;
      for(let s=0;s<=360;s++){const ang=Math.PI/2+(s/360-0.5)*Math.PI*0.9;const d=[Math.cos(ang),Math.sin(ang)];const n=[d[1],-d[0]]; // n points right
        const a=Math.max(...hA.map(p=>V.dot(n,p))),b=Math.min(...hB.map(p=>V.dot(n,p)));const gap=b-a;if(gap<-1e-12)continue;
        const c=(a+b)/2;const p0=V.mul(n,c);
        let ok=true;for(const O of others){const vs=O.map(q=>V.dot(n,q)-c);if(Math.min(...vs)<-1e-9&&Math.max(...vs)>1e-9){ok=false;break;}}
        if(!ok)continue;const ma=minAng(d);const sc=Math.min(gap,0.2*w)+0.05*w*ma+1e-3*Math.cos(ang-Math.PI/2);if(!best||sc>best.sc)best={sc,p:p0,d:[-d[0],-d[1]]};}
      if(!best){info.log.push('(ii) no separating line in band '+bj);continue;}
      if(cfg.open(best.p,best.d,w))info.stepii++;}}
  const pieces=finalPieces(cfg);
  return {cfg,pieces,info};}

// pieces = connected components (convex), owned edges identified by shifting back onto ∂T
function finalPieces(cfg){
  const out=[];
  for(const cs of cfg.comps()){const C0=cfg.cells[cs[0]];const pts=cs.flatMap(i=>cfg.cells[i].poly);let H=hull(pts);
    const A=cs.reduce((s,i)=>s+Math.abs(area(cfg.cells[i].poly)),0);const convex=Math.abs(area(H)-A)<1e-7*Math.max(1,A);
    H=cleanPoly(H,1e-9);
    // owned edges: hull edges covered by tagged cell edges
    const sh=C0.shift;const owned=[];const tags=[];
    for(let i=0;i<H.length;i++){const a=H[i],b=H[(i+1)%H.length];const m=V.mul(V.add(a,b),0.5);let tg=-1;
      for(const k of cs){const C=cfg.cells[k];for(let j=0;j<C.poly.length;j++){if(C.tags[j]<0)continue;const u=C.poly[j],v=C.poly[(j+1)%C.poly.length];
          if(ptSeg(m,u,v)<1e-8){tg=C.tags[j];break;}}if(tg>=0)break;}
      tags.push(tg);if(tg>=0)owned.push(i);}
    out.push({poly:H,tags,owned,shift:sh,convex,area:A,cells:cs.length});}
  return out;}


/* =====================================================================================
   Row module (§5d): pleat start, entry port, row, exit port, pleat end (h=1: ports only).
   Row frame: band 0<=y'<=h, side B at y'=0, side A at y'=h, travel +x'.  Paper strip y in [0,1].
   ===================================================================================== */
function kappa(h){
  if(h>=1-1e-12)return {br:[{p:0,q:1,s:1,c:0,cls:0}],a:null,u:0};
  const u=(1-h)/4,a=1/8+h/4;
  return {u,a,b:a+u,br:[{p:0,q:a,s:1,c:0,cls:2},{p:a,q:a+u,s:-1,c:2*a,cls:1},{p:a+u,q:1-a-u,s:1,c:-2*u,cls:0},
    {p:1-a-u,q:1-a,s:-1,c:h+1-2*a,cls:1},{p:1-a,q:1,s:1,c:-4*u,cls:2}]};}
function box(x0,x1,y0,y1){return [[x0,y0],[x1,y0],[x1,y1],[x0,y1]];}
function region(B,cons){let R=B;for(const [n,c] of cons){R=clipHP(R,n,c);if(!R.length)break;}return R;}
// pull a Q-region (row frame) back through the kappa branches: list of {P (paper), K (paper->Q), k}
function pullKappa(X,K){const out=[];
  for(let k=0;k<K.br.length;k++){const b=K.br[k];const lo=Math.min(b.s*b.p+b.c,b.s*b.q+b.c),hi=Math.max(b.s*b.p+b.c,b.s*b.q+b.c);
    let R=clipHP(clipHP(X,[0,-1],-lo),[0,1],hi);if(!R.length||Math.abs(area(R))<1e-13)continue;
    let P=R.map(q=>[q[0],(q[1]-b.c)/b.s]);if(b.s<0)P.reverse();out.push({P,K:{a:1,b:0,c:0,d:b.s,e:0,f:b.c},k,b});}
  return out;}
// canonical entry end, B-version, P=(0,h/2), rope on the left; returns faces + cut state at x=xs
function entryCanonical(h,beta,par){
  const K=kappa(h),P=[0,h/2],O=[0,0],B2=[h/2*Math.tan(beta),0],T3=[h/2/Math.tan(beta),h];
  const rPB2=I.refl(P,B2),rPO=I.refl(P,O),phiA=I.comp(rPB2,rPO),phiB=rPB2,phiD=I.refl(P,T3);
  const faces=[];const tb=h/2*Math.tan(beta),tc=h/2/Math.tan(beta);
  let xs,xc,x0=null,e=0;
  if(K.a===null){xs=-tb-par.mcut;xc=xs;}
  else{e=Math.max(K.a,0.5-K.b);x0=-tb-par.g-e;xc=x0+e+0.1;xs=2*x0-tc-par.mcut;}
  // mid zone: Phi faces A,B,D composed with kappa
  const XA=box(xc,0,0,h/2),XB=[O,B2,P],XD=[[xc,h/2],P,T3,[xc,h]];
  for(const [lab,X,phi] of [['A',XA,phiA],['B',XB,phiB],['D',XD,phiD]])
    for(const r of pullKappa(X,K))faces.push({P:r.P,g:I.comp(phi,r.K),kind:'P',lab,cls:r.b.cls,sK:r.b.s});
  if(K.a!==null){const a=K.a,b=K.b,u=K.u;const Bx=box(xs,xc,0,0.5);
    const uf=[];
    uf.push({lab:'BL',R:region(Bx,[[[0,-1],0],[[0,1],a],[[-1,-1],-(x0+a)]]),f:I.id()});
    const rT=I.refl([x0+a,0],[x0,a]);uf.push({lab:'T',R:region(Bx,[[[0,-1],0],[[1,1],x0+a],[[-1,1],a-x0]]),f:rT});
    uf.push({lab:'M',R:region(Bx,[[[0,-1],-a],[[0,1],b],[[-1,0],-x0]]),f:{a:1,b:0,c:0,d:-1,e:0,f:2*a}});
    const fTL={a:1,b:0,c:0,d:1,e:0,f:-2*u};uf.push({lab:'TL',R:region(Bx,[[[0,-1],-b],[[-1,1],b-x0]]),f:fTL});
    const rNW=I.refl([x0,b],[x0+0.5-b,0.5]);uf.push({lab:'TT',R:region(Bx,[[[1,-1],x0-b],[[-1,-1],-x0-b]]),f:I.comp(fTL,rNW)});
    const fR=I.rot([x0,a],Math.PI);uf.push({lab:'R',R:region(Bx,[[[1,-1],x0-a],[[1,0],x0],[[1,1],x0+b]]),f:fR});
    const mu1={a:1,b:0,c:0,d:-1,e:0,f:1};
    for(const U of uf){if(!U.R.length||Math.abs(area(U.R))<1e-13)continue;
      faces.push({P:U.R,g:I.comp(phiA,U.f),kind:'U',lab:U.lab,half:0});
      faces.push({P:U.R.map(q=>[q[0],1-q[1]]).reverse(),g:I.comp(I.comp(phiA,U.f),mu1),kind:'U',lab:U.lab,half:1});}
    var cutLo=I.comp(phiA,fR),cutUp=I.comp(I.comp(phiA,fR),mu1);
  }else{var cutLo=phiA,cutUp=phiD;}
  return {faces,xs,cutLo,cutUp,K,B2,T3,P,x0};}
const ISO_MU=h=>({a:1,b:0,c:0,d:-1,e:0,f:h});
function tfFace(F,tp,tq){const tpi=I.inv(tp);let P=F.P.map(q=>I.ap(tp,q));if(area(P)<0)P.reverse();
  const G=Object.assign({},F);G.P=P;G.g=I.comp(I.comp(tq,F.g),tpi);return G;}
// geometry of a row in its frame: corners and angles
function endPort(row,side,ver,par){
  const h=row.h;let beta,Px;
  if(side==='in'){const phi=Math.atan2(h,row.xAL-row.xBL);
    if(ver==='B'){beta=phi/2;Px=row.xBL-h/2*Math.tan(beta);}else{beta=(Math.PI-phi)/2;Px=row.xAL-h/2*Math.tan(beta);}}
  else{const phi=Math.atan2(h,row.xBR-row.xAR);
    if(ver==='B'){beta=phi/2;Px=row.xBR+h/2*Math.tan(beta);}else{beta=(Math.PI-phi)/2;Px=row.xAR+h/2*Math.tan(beta);}}
  const can=entryCanonical(h,beta,par);
  let tp=I.tr([Px,0]),tq=I.tr([Px,0]);
  if(side==='out'){const sx={a:-1,b:0,c:0,d:1,e:0,f:0};tp=I.comp(tp,sx);tq=I.comp(tq,sx);}
  if(ver==='A'){tp=I.comp(tp,ISO_MU(1));tq=I.comp(tq,ISO_MU(h));}
  const faces=can.faces.map(F=>{const G=tfFace(F,tp,tq);G.side=side;return G;});
  // cut state: paper x of the cut and the maps of the lower / upper paper halves
  const xcut=I.ap(tp,[can.xs,0])[0];
  let lo=I.comp(I.comp(tq,can.cutLo),I.inv(tp)),up=I.comp(I.comp(tq,can.cutUp),I.inv(tp));
  if(ver==='A'){const t=lo;lo=up;up=t;}
  const Pp=I.ap(tq,can.P),B2=I.ap(tq,can.B2),T3=I.ap(tq,can.T3);
  return {faces,xcut,lo,up,beta,Px,P:Pp,B2,T3,ver,side};}
function rowModule(row,vin,vout,par){
  const h=row.h,K=kappa(h);
  const ein=endPort(row,'in',vin,par),eout=endPort(row,'out',vout,par);
  // C: band ∩ entry wedge ∩ exit wedge
  const cen=row.cen;let X=box(Math.min(ein.xcut,row.xBL,row.xAL)-5,Math.max(eout.xcut,row.xBR,row.xAR)+5,0,h);
  for(const E of [ein,eout])for(const Q of [E.B2,E.T3]){let n=V.perp(V.sub(Q,E.P));let c=V.dot(n,E.P);if(V.dot(n,cen)>c){n=V.mul(n,-1);c=-c;}X=clipHP(X,n,c);}
  const faces=[];for(const r of pullKappa(X,K))faces.push({P:r.P,g:r.K,kind:'P',lab:'C',cls:r.b.cls,sK:r.b.s,side:null});
  for(const F of ein.faces)faces.push(F);for(const F of eout.faces)faces.push(F);
  let out=faces;
  { // split C by the flat line through the midpoints of the long sides: the explicit pairwise order of
    // lem:twoblock can be cyclic on C (C<A_out<R_in<C, no common point); after the split it has a linear extension
    const m0=[(row.xBL+row.xBR)/2,0],m1=[(row.xAL+row.xAR)/2,h];const nn=V.perp(V.sub(m1,m0));
    out=[];for(const F of faces){if(F.lab!=='C'){out.push(F);continue;}for(const G of splitByImageLine(F,nn,V.dot(nn,m0)))out.push(G);}}
  return {faces:out,ein,eout,x0:ein.xcut,x1:eout.xcut,Cregion:X};}
function splitByImageLine(F,n,c){ // n·g(p) <= c and >= c parts (flat edge)
  const m=[n[0]*F.g.a+n[1]*F.g.c,n[0]*F.g.b+n[1]*F.g.d],cc=c-(n[0]*F.g.e+n[1]*F.g.f);
  const A=clipHP(F.P,m,cc),B=clipHP(F.P,[-m[0],-m[1]],-cc);const out=[];
  for(const P of [A,B])if(P.length&&Math.abs(area(P))>1e-13){const G=Object.assign({},F);G.P=P;out.push(G);}
  return out;}
// explicit order inside a row module (test_module.key_cmp, lem:twoblock): true if a above b
const RANKU={R:0,TT:1,TL:2,M:3,BL:4,T:5},CLSU={TL:0,M:1,BL:2},RANK2={C:0,B:1,A:2,D:3};
function h2(f){if(f.kind==='U'){if(f.lab==='R'||f.lab==='TT')return [-1,0,0];if(f.lab==='T')return [9,0,0];
    const c=CLSU[f.lab],inner=f.half===0?2:3;return [c,c!==1?inner:-inner,0];}
  const rk=RANK2[f.lab];return [f.cls,f.sK>0?rk:-rk,f.side==='in'?1:0];}
function keyCmp(a,b){
  if(a.side&&b.side&&a.side!==b.side)return a.side==='in';
  if(a.kind==='U'&&b.kind==='U'){const ra=RANKU[a.lab],rb=RANKU[b.lab];if(ra!==rb)return ra>rb;
    const sig=(a.lab==='M'||a.lab==='T'||a.lab==='TT')?-1:1;if(a.half===b.half)return null;return sig>0?a.half>b.half:a.half<b.half;}
  const ka=h2(a),kb=h2(b);for(let i=0;i<3;i++)if(ka[i]!==kb[i])return ka[i]>kb[i];return null;}


/* ---------- overlaps, local orders, export ---------- */
function imgOf(F){return F.P.map(q=>I.ap(F.g,q));}
// overlapping pairs among polygons (array of convex CCW polygons); grid bucketing
function overlapPairs(polys,aeps){
  polys=polys.map(P=>area(P)<0?P.slice().reverse():P);
  const n=polys.length;if(!n)return [];const bb=polys.map(bbox);
  let W=0;for(const b of bb)W+=Math.max(b[2]-b[0],b[3]-b[1]);const cs=Math.max(W/n*2,1e-9);
  const grid=new Map();const out=[];
  for(let i=0;i<n;i++){const b=bb[i];const i0=Math.floor(b[0]/cs),i1=Math.floor(b[2]/cs),j0=Math.floor(b[1]/cs),j1=Math.floor(b[3]/cs);
    const seen=new Set();
    for(let x=i0;x<=i1;x++)for(let y=j0;y<=j1;y++){const k=x+','+y;const L=grid.get(k);
      if(L)for(const j of L){if(seen.has(j))continue;seen.add(j);const c=bb[j];
        if(c[0]>=b[2]||b[0]>=c[2]||c[1]>=b[3]||b[1]>=c[3])continue;
        if(interArea(polys[i],polys[j])>aeps)out.push([j,i]);}
      if(L)L.push(i);else grid.set(k,[i]);}}
  return out;}
// linear extension of the relation cmp on overlapping pairs (Kahn); returns rank array or throws on a cycle
function linearize(faces,cmp,aeps){
  const imgs=faces.map(imgOf);const pairs=overlapPairs(imgs,aeps===undefined?1e-12:aeps);
  const n=faces.length,out=[...Array(n)].map(()=>[]),indeg=new Array(n).fill(0);let undef=0;
  for(const [i,j] of pairs){const r=cmp(faces[i],faces[j]);if(r===null){undef++;continue;}
    const [lo,hi]=r?[j,i]:[i,j];out[lo].push(hi);indeg[hi]++;}
  const q=[];for(let i=0;i<n;i++)if(!indeg[i])q.push(i);const rank=new Array(n).fill(-1);let k=0;
  while(q.length){const i=q.shift();rank[i]=k++;for(const j of out[i])if(--indeg[j]===0)q.push(j);}
  if(k<n){const err=new Error('cycle in local order ('+(n-k)+' faces)');
    const st=new Array(n).fill(0),stack=[];let cyc=null;const dfs=u=>{st[u]=1;stack.push(u);for(const v of out[u]){if(cyc)return;if(st[v]===1){cyc=stack.slice(stack.indexOf(v));return;}if(!st[v])dfs(v);}stack.pop();st[u]=2;};
    for(let i=0;i<n&&!cyc;i++)if(!st[i])dfs(i);err.cycle=cyc;throw err;}
  return {rank,pairs:pairs.length,undef};}
// export for checker/indep_check.py: paper mirrored (y -> -y) so that s = sign det = -σ (colour = s -1)
function toChecker(faces,opt){
  opt=opt||{};const tri=[];const mir=opt.mirror!==false;
  for(const F of faces){let P=F.P;if(area(P)<0)P=P.slice().reverse();
    for(let j=1;j+1<P.length;j++){const Tv=[P[0],P[j],P[j+1]];if(Math.abs(area(Tv))<1e-13)continue;
      const Fi=Tv.map(q=>I.ap(F.g,q));
      tri.push({V:Tv.map(q=>mir?[q[0],-q[1]]:[q[0],q[1]]),F:Fi,s:mir?-Math.sign(I.det(F.g)):Math.sign(I.det(F.g)),r:F.rank});}}
  const pairs=overlapPairs(tri.map(t=>area(t.F)<0?t.F.slice().reverse():t.F),opt.aeps||1e-13);
  const above=pairs.map(([i,j])=>tri[i].r>tri[j].r?[i,j]:[j,i]);
  let paper=opt.paper;if(mir)paper=paper.map(q=>[q[0],-q[1]]).reverse();
  const xs=paper.map(q=>q[0]),ys=paper.map(q=>q[1]);
  const d={name:opt.name||'strip',W:Math.max(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys)),paper,
    T:opt.T,H:opt.H||[],faces:tri.map(t=>({V:t.V,F:t.F,s:t.s})),above};
  if(opt.free)d.free=opt.free;return d;}


/* =====================================================================================
   Scale (尺度), rows (行), visiting order
   ===================================================================================== */
function pieceBase(H,owned){ // base edge index and the min positive gap of vertex distances
  const cand=owned.length?[owned[0]]:H.map((_,i)=>i);const L=[];
  for(const i of cand){const a=H[i],b=H[(i+1)%H.length];const u=V.nrm(V.sub(b,a));const n=[-u[1],u[0]];
    const ds=H.map(q=>V.dot(n,V.sub(q,a))).sort((x,y)=>x-y);let dd=Infinity;
    for(let k=1;k<ds.length;k++){const g=ds[k]-ds[k-1];if(g>1e-9*(1+ds[ds.length-1]))dd=Math.min(dd,g);}
    let mp=Math.PI/2;for(let j=0;j<H.length;j++){if(j===i)continue;const e=V.nrm(V.sub(H[(j+1)%H.length],H[j]));const ph=Math.acos(Math.min(1,Math.abs(V.dot(u,e))));if(ph>1e-6)mp=Math.min(mp,ph);}
    L.push({i,dd,W:ds[ds.length-1],mp});}
  if(L.length===1)return L[0];
  // owner-free piece: keep end angles large (port junk and thin faces grow like cot of half the end angle), then the largest gap
  const mx=Math.min(Math.max(...L.map(c=>c.mp)),20*Math.PI/180);let best=null;
  for(const c of L){if(c.mp<0.8*mx)continue;if(!best||c.dd>best.dd*1.5||(c.dd>best.dd/1.5&&c.W<best.W))best=c;}
  return best;}
function planBase(T,holes,opt){
  const w=opt.w,trials=opt.trials||12;const rnd=mulberry(opt.seed||7);let best=null;
  const ws=opt.autoW?[w,w/3,w/10,w/30]:[w];const cands=[];
  // best achievable minimum angle between an edge and the horizontal over all rotations; use 80% of it (≤ 15°)
  const edirs=[];for(const r of T.concat(holes||[]))for(let k=0;k<r.length;k++){const d=V.sub(r[(k+1)%r.length],r[k]);if(V.len(d)>1e-12)edirs.push(Math.atan2(d[1],d[0]));}
  const minEA=a=>Math.min(...edirs.map(t=>Math.abs(Math.sin(t+a))));let bestEA=0;for(let k=0;k<720;k++)bestEA=Math.max(bestEA,minEA(k*Math.PI/720));
  const eaThr=opt.minEdgeAngle!==undefined?Math.sin(opt.minEdgeAngle*Math.PI/180):Math.min(Math.sin(15*Math.PI/180),0.8*bestEA);
  for(let t=0;t<trials;t++){let ang=t===0?(opt.angle||0.3):rnd()*Math.PI;for(let g=0;g<200&&minEA(ang)<eaThr;g++)ang=rnd()*Math.PI;const seed=1+Math.floor(rnd()*1e6);
   for(const w of ws){
    const rotp=p=>[p[0]*Math.cos(ang)-p[1]*Math.sin(ang),p[0]*Math.sin(ang)+p[1]*Math.cos(ang)];
    const Tr=T.map(r=>r.map(rotp)),Hr=(holes||[]).map(r=>r.map(rotp));
    // rotation must be generic: no horizontal edge, distinct vertex heights
    const allp=Tr.concat(Hr).flat();const uq=[];for(const q of allp)if(!uq.some(r=>V.dist(r,q)<1e-12))uq.push(q);const ys=uq.map(p=>p[1]).sort((a,b)=>a-b);let okg=true;
    for(let k=1;k<ys.length;k++)if(ys[k]-ys[k-1]<1e-4)okg=false;
    // edges far from horizontal: the horizontal walls of (i) then meet every edge at a non-small angle (keeps port junk small)
    for(const r of Tr.concat(Hr))for(let k=0;k<r.length;k++){const d=V.nrm(V.sub(r[(k+1)%r.length],r[k]));if(Math.abs(d[1])<eaThr*0.999)okg=false;}
    if(!okg&&!opt.skipI)continue;
    let B;try{B=bands(Tr,Hr,{w,seed,skipI:!!opt.skipI,randLines:!!opt.randLines&&t>0});}catch(e){continue;}
    if(B.pieces.some(p=>!p.convex||p.owned.length>1))continue;
    let dmin=Infinity,Wsum=0;for(const P of B.pieces){const b=pieceBase(P.poly,P.owned);P.base=b;dmin=Math.min(dmin,b.dd);Wsum+=b.W;}
    // gadget margin: port junk reaches about (1/2)max(tan β, cot β)+g+3 along an end line (β = half the end angle)
    let gapReq=opt.gap,minA=Math.PI;for(const P of B.pieces){const H=P.poly,i0=P.base.i;const u=V.nrm(V.sub(H[(i0+1)%H.length],H[i0]));
      for(let i=0;i<H.length;i++){if(i===i0)continue;const e=V.nrm(V.sub(H[(i+1)%H.length],H[i]));let phi=Math.acos(Math.max(-1,Math.min(1,Math.abs(V.dot(u,e)))));
        if(phi<1e-6)continue;minA=Math.min(minA,phi);const ex=0.5*Math.max(Math.tan(phi/2),1/Math.tan(phi/2),Math.tan((Math.PI-phi)/2),1/Math.tan((Math.PI-phi)/2))+(opt.g||1)+3.5;gapReq=Math.max(gapReq,ex);}}
    const lam=Math.max(gapReq/(2*w),0.5/dmin)*1.02;const ext=bbox(B.pieces.flatMap(P=>P.poly));
    const span=lam*Math.max(ext[2]-ext[0],ext[3]-ext[1]);const est=Wsum*lam+span/40; // rows, plus a little for rope length
    cands.push({ang,seed,B,lam,est,Tr,Hr,dmin,w,span,gapReq,minA});}}
  if(cands.length){const bestA=Math.max(...cands.map(c=>c.minA));const thr=Math.min((opt.minEndAngle||12)*Math.PI/180,bestA-1.5*Math.PI/180);
    for(const c of cands)if(c.minA>=thr&&(!best||c.est<best.est))best=c;}
  if(!best)throw new Error('no generic decomposition found');
  return best;}
// number of rows for a level gap D>1/2: heights D/m in (1/2,1]; heights very close to 1 (thin kappa layers,
// u=(1-h)/4) or to 1/2 are avoided when another admissible m exists (both are allowed by the paper)
const HDEL=0.1;
function rowCount(D){let m=Math.ceil(D-1e-9);if(D/m>1-HDEL&&D/(m+1)>0.5+HDEL)m++;return m;}
function badLevels(pieces,lam){let bad=0;for(const P of pieces){const H=P.poly,i=P.base.i;const a=H[i],b=H[(i+1)%H.length];const u=V.nrm(V.sub(b,a)),n=[-u[1],u[0]];
    const ds=H.map(q=>V.dot(n,V.sub(q,a))*lam).sort((x,y)=>x-y);for(let k=1;k<ds.length;k++){const D=ds[k]-ds[k-1];if(D<1e-7*(1+ds[k]))continue;
      const h=D/rowCount(D);if(h>1-HDEL&&h<1-1e-12)bad++;if(h<0.5+HDEL)bad++;}}return bad;}
function makeRows(pieces,lam){
  const rows=[];
  pieces.forEach((P,pi)=>{const H=P.poly.map(q=>V.mul(q,lam));P.H=H;const i=P.base.i;const a=H[i],b=H[(i+1)%H.length];
    const u=V.nrm(V.sub(b,a)),n=[-u[1],u[0]];const ds=H.map(q=>V.dot(n,V.sub(q,a))).sort((x,y)=>x-y);
    const U=[];for(const d of ds)if(!U.length||d-U[U.length-1]>1e-7*(1+d))U.push(d);U[0]=0;
    const lev=[0];for(let k=1;k<U.length;k++){const D=U[k]-U[k-1];if(D<=0.5)throw new Error('scale too small: gap '+D);
      const m=rowCount(D);for(let j=1;j<=m;j++)lev.push(U[k-1]+D*j/m);}
    const m=lev.length-1;P.rows=[];P.owner=P.owned.length>0;P.baseEdge=[a,b];
    for(let k=1;k<=m;k++){let R=clipHP(clipHP(H,V.mul(n,-1),-(lev[k-1]+V.dot(n,a))),n,lev[k]+V.dot(n,a));R=cleanPoly(R,1e-7);
      rows.push({piece:pi,k,m,h:lev[k]-lev[k-1],poly:R,n,a,l0:lev[k-1],l1:lev[k]});P.rows.push(rows.length-1);}});
  return rows;}
function rowFrame(row,o){ // o=+1: side A toward e_H (d=l0); o=-1: side A at d=l1
  const Y=o>0?V.mul(row.n,-1):row.n.slice();const X=[Y[1],-Y[0]];const O=V.add(row.a,V.mul(row.n,o>0?row.l1:row.l0));
  const G={a:X[0],b:Y[0],c:X[1],d:Y[1],e:O[0],f:O[1]};const Gi=I.inv(G);const Q=row.poly.map(q=>I.ap(Gi,q));const h=row.h,tol=1e-6;
  const onB=Q.filter(q=>Math.abs(q[1])<tol).map(q=>q[0]),onA=Q.filter(q=>Math.abs(q[1]-h)<tol).map(q=>q[0]);
  if(!onB.length||!onA.length)throw new Error('row corners not found');
  const fr={G,h,o,xBL:Math.min(...onB),xBR:Math.max(...onB),xAL:Math.min(...onA),xAR:Math.max(...onA)};
  fr.tri=fr.xBR-fr.xBL<1e-7;fr.triA=fr.xAR-fr.xAL<1e-7;if(fr.tri){fr.xBR=fr.xBL;}
  fr.cen=centroid(Q);return fr;}
function visitOrder(pieces){ // greedy nearest-neighbour tour over pieces
  const c=pieces.map(P=>centroid(P.H));const left=new Set(pieces.map((_,i)=>i));let cur=[...left].reduce((b,i)=>c[i][0]-c[i][1]<c[b][0]-c[b][1]?i:b,0);
  const ord=[];while(left.size){left.delete(cur);ord.push(cur);let bj=-1,bd=Infinity;for(const j of left){const d=V.dist(c[cur],c[j]);if(d<bd){bd=d;bj=j;}}cur=bj;}
  return ord;}

/* =====================================================================================
   Rope routing (lem:route): visibility graph around pieces inflated by the rope half-width
   ===================================================================================== */
function inflate(H,r){ // miter offset of a convex CCW polygon (bevel at acute corners)
  const n=H.length,out=[];
  for(let i=0;i<n;i++){const p=H[(i+n-1)%n],q=H[i],s=H[(i+1)%n];const u1=V.nrm(V.sub(q,p)),u2=V.nrm(V.sub(s,q));
    const n1=[u1[1],-u1[0]],n2=[u2[1],-u2[0]];const bis=V.nrm(V.add(n1,n2));const cosh=V.dot(bis,n1);
    if(cosh>0.70){out.push(V.add(q,V.mul(bis,r/cosh)));}
    else{const t=V.perp(bis);const k=r*(1-cosh)/Math.max(1e-9,Math.sqrt(1-cosh*cosh));
      out.push(V.add(V.add(q,V.mul(bis,r)),V.mul(t,-k*1.0001)),V.add(V.add(q,V.mul(bis,r)),V.mul(t,k*1.0001)));}}
  return out;}
function routePath(s,ds,e,de,obs,opt){
  // obs: [{H (piece), F (inflated)}]; returns polyline [s, q_s, ..., q_e, e]
  const s0=opt.s0,s1=opt.s1;const qs=V.add(s,V.mul(ds,s0)),qe=V.sub(e,V.mul(de,s1));
  const box0=bbox([s,e,qs,qe]);
  for(let grow=4;grow<1e7;grow*=2.5){const bx=[box0[0]-grow,box0[1]-grow,box0[2]+grow,box0[3]+grow];
    const loc=obs.filter(o=>{const b=o.bb;return !(b[0]>bx[2]||b[2]<bx[0]||b[1]>bx[3]||b[3]<bx[1]);});
    const nodes=[qs,qe];for(const o of loc)for(const q of o.F)nodes.push(q);
    const vis=(a,b)=>{for(const o of loc){const bb=o.bb;if(Math.max(a[0],b[0])<bb[0]||Math.min(a[0],b[0])>bb[2]||Math.max(a[1],b[1])<bb[1]||Math.min(a[1],b[1])>bb[3])continue;
        if(segPolyDist(a,b,o.H)<0.25-1e-7)return false;}return true;};
    // Dijkstra with lazy visibility
    const N=nodes.length,dist=new Array(N).fill(Infinity),prev=new Array(N).fill(-1),done=new Array(N).fill(false);dist[0]=0;
    for(let it=0;it<N;it++){let u=-1,bd=Infinity;for(let i=0;i<N;i++)if(!done[i]&&dist[i]<bd){bd=dist[i];u=i;}
      if(u<0||u===1)break;done[u]=true;
      for(let v=0;v<N;v++){if(done[v])continue;const nd=dist[u]+V.dist(nodes[u],nodes[v]);if(nd>=dist[v])continue;
        if(!vis(nodes[u],nodes[v]))continue;dist[v]=nd;prev[v]=u;}}
    if(dist[1]<Infinity){const path=[];for(let v=1;v>=0;v=prev[v])path.push(nodes[v]);path.reverse();
      // drop leading/trailing duplicates of the fixed points
      return [s].concat(path,[e]);}
    if(loc.length===obs.length)break;}
  return null;}
function turnsOf(path){ // turning angles at interior vertices (signed)
  const t=[];for(let i=1;i+1<path.length;i++){const a=V.nrm(V.sub(path[i],path[i-1])),b=V.nrm(V.sub(path[i+1],path[i]));t.push(Math.atan2(V.cr(a,b),V.dot(a,b)));}return t;}
function simplifyPath(path){ // remove (near) collinear interior vertices and zero-length segments
  const out=[path[0]];for(let i=1;i<path.length;i++){if(V.dist(path[i],out[out.length-1])<1e-9)continue;out.push(path[i]);}
  let ch=true;while(ch){ch=false;for(let i=1;i+1<out.length;i++){const a=V.sub(out[i],out[i-1]),b=V.sub(out[i+1],out[i]);
      if(Math.abs(V.cr(V.nrm(a),V.nrm(b)))<1e-9&&V.dot(a,b)>0){out.splice(i,1);ch=true;break;}}}
  return out;}
function creaseOK(path,extra){ // consecutive turn creases must not meet inside the strip
  const t=turnsOf(path);const ext=t.map(th=>0.25*Math.abs(1/Math.tan(Math.abs(th)/2)));
  const L=[];for(let i=0;i+1<path.length;i++)L.push(V.dist(path[i],path[i+1]));
  if(!t.length)return {ok:true,t};
  if(L[0]<ext[0]+extra||L[L.length-1]<ext[ext.length-1]+extra)return {ok:false,t,where:'end'};
  for(let i=0;i+1<t.length;i++)if(L[i+1]<ext[i]+ext[i+1]+extra)return {ok:false,t,where:i};
  return {ok:true,t};}
function mergeShort(path,obsH){ // merge two turns joined by a too-short segment into one (intersection of neighbours)
  for(let guard=0;guard<200;guard++){const t=turnsOf(path);const ext=t.map(th=>0.25*Math.abs(1/Math.tan(Math.abs(th)/2)));let done=true;
    for(let i=0;i+1<t.length;i++){const L=V.dist(path[i+1],path[i+2]);if(L>=ext[i]+ext[i+1]+0.05)continue;
      // vertices path[i+1], path[i+2]; lines (path[i],path[i+1]) and (path[i+2],path[i+3])
      const p=path[i],q=path[i+1],r=path[i+2],w=path[i+3];const d1=V.sub(q,p),d2=V.sub(w,r);const den=V.cr(d1,d2);
      if(Math.abs(den)<1e-12)continue;const tt=V.cr(V.sub(r,p),d2)/den;if(tt<=1e-9)continue;const X=V.add(p,V.mul(d1,tt));
      const tt2=V.cr(V.sub(r,p),d1)/den;if(tt2>=1-1e-9)continue;
      if(obsH.some(H=>segPolyDist(q,X,H)<0.25-1e-9||segPolyDist(X,r,H)<0.25-1e-9))continue;
      const np=path.slice(0,i+1).concat([X],path.slice(i+3));if(V.dist(np[0],np[1])<0.6||V.dist(np[np.length-2],np[np.length-1])<0.6)continue;path=np;done=false;break;}
    if(done)break;}
  return path;}
function coarsen(H,minTurn){ // circumscribing convex polygon without small exterior angles (contains H)
  let P=H.slice();
  for(let guard=0;guard<200&&P.length>3;guard++){const n=P.length;const ext=P.map((q,i)=>{const a=V.sub(q,P[(i+n-1)%n]),b=V.sub(P[(i+1)%n],q);return Math.atan2(V.cr(a,b),V.dot(a,b));});
    let bi=-1,bs=Infinity;for(let i=0;i<n;i++){const j=(i+1)%n;const sum=ext[i]+ext[j];if(Math.min(ext[i],ext[j])<minTurn&&sum<Math.PI*0.6&&sum<bs){bs=sum;bi=i;}}
    if(bi<0)break;const i=bi,j=(i+1)%n;const u=P[(i+n-1)%n],v=P[i],w=P[j],x=P[(j+1)%n];
    const d1=V.sub(v,u),d2=V.sub(w,x);const den=V.cr(d1,d2);if(Math.abs(den)<1e-12)break;const t=V.cr(V.sub(x,u),d2)/den;const X=V.add(u,V.mul(d1,t));
    P=P.filter((_,k)=>k!==i&&k!==j);P.splice(i<j?i:0,0,X);if(i>j){} }
  return area(P)<0?P.reverse():P;}
function killSmallTurns(path,obsH,minTurn){
  const clear=(a,b)=>!obsH.some(H=>segPolyDist(a,b,H)<0.25-1e-9);
  for(let guard=0;guard<300;guard++){const t=turnsOf(path);let changed=false;
    for(let i=0;i<t.length&&!changed;i++){if(Math.abs(t[i])>=minTurn)continue;const v=i+1; // vertex index in path
      if(v>=2&&v<=path.length-3&&clear(path[v-1],path[v+1])){path=path.slice(0,v).concat(path.slice(v+1));changed=true;break;}
      for(const w of [v+1,v-1]){const a=Math.min(v,w),b=Math.max(v,w);if(a<1||b>path.length-2)continue;
        const p=path[a-1],q=path[a],r=path[b],z=path[b+1];const d1=V.sub(q,p),d2=V.sub(z,r);const den=V.cr(d1,d2);if(Math.abs(den)<1e-12)continue;
        const tt=V.cr(V.sub(r,p),d1)/den,tq=V.cr(V.sub(r,p),d2)/den;if(tq<=1e-9||tt>=1-1e-9)continue;const X=V.add(p,V.mul(d1,tq));
        if(!clear(p,X)||!clear(X,z))continue;const np=path.slice(0,a).concat([X],path.slice(b+1));
        if(V.dist(np[0],np[1])<0.6||V.dist(np[np.length-2],np[np.length-1])<0.6)continue;path=np;changed=true;break;}}
    if(!changed){ // remaining tiny turn: replace it by a triangular bump (3 turns, same parity)
      for(let i=0;i<t.length&&!changed;i++){if(Math.abs(t[i])>=minTurn)continue;const v=i+1,c=path[v];
        const din=V.nrm(V.sub(c,path[v-1])),dout=V.nrm(V.sub(path[v+1],c));const Lin=V.dist(c,path[v-1]),Lout=V.dist(c,path[v+1]);
        for(const D of [1.8,2.6,4,1.2,0.8])for(const D2 of [D,4,8,1.2])for(const sg of [1,-1]){if(changed)break;if(Lin<D+0.9||Lout<D2+0.9)continue;
          const A=V.sub(c,V.mul(din,D)),B=V.add(c,V.mul(dout,D2));const mid=V.mul(V.add(A,B),0.5);const ab=V.nrm(V.sub(B,A));
          const P=V.add(mid,V.mul(V.perp(ab),sg*V.dist(A,B)/2*Math.tan(0.45)));
          if(!clear(A,P)||!clear(P,B))continue;const np=path.slice(0,v).concat([A,P,B],path.slice(v+1));
          if(creaseOK(np.slice(Math.max(0,v-2),v+5),0.03).ok){path=np;changed=true;}}
        // last resort: overshoot c+t·d_in then back to c+t·d_out (two large turns; parity is fixed afterwards)
        for(const tt of [0.6,0.9,1.3,2]){if(changed)break;if(Lout<tt+0.5)continue;const c1=V.add(c,V.mul(din,tt)),c2=V.add(c,V.mul(dout,tt));
          if(!clear(path[v-1],c1)||!clear(c1,c2))continue;const np=path.slice(0,v).concat([c1,c2],path.slice(v+1));
          if(creaseOK(np.slice(Math.max(0,v-2),v+5),0.03).ok){path=np;changed=true;}}}}
    if(!changed)break;}
  return path;}
function addLoop(path,obsH){ // parity fix 2: a small triangular loop (three turns of 120°) on a straight segment
  const clear=(a,b)=>!obsH.some(H=>segPolyDist(a,b,H)<0.25-1e-9);
  const segs=[];for(let i=0;i+1<path.length;i++)segs.push([V.dist(path[i],path[i+1]),i]);segs.sort((a,b)=>b[0]-a[0]);
  for(const [L,i] of segs)for(const l of [0.8,1.2,2])for(const sg of [1,-1])for(const f of [0.5,0.3,0.7]){
    const u=path[i],v=path[i+1],d=V.nrm(V.sub(v,u));const A=V.add(u,V.mul(d,f*L+l/2));
    if(V.dist(u,A)<l+0.9||V.dist(A,v)<0.9)continue;const B=V.add(A,V.mul(V.rot(d,sg*2*Math.PI/3),l)),C=V.sub(A,V.mul(d,l));
    if(!clear(A,B)||!clear(B,C))continue;const np=path.slice(0,i+1).concat([A,B,C],path.slice(i+1));
    if(creaseOK(np.slice(Math.max(0,i-1),Math.min(np.length,i+6)),0.03).ok)return np;}
  return null;}
function addTurn(path,obsH){ // parity fix: replace the sharpest-room vertex c (turn θ) by c+t·d_in, c+t·d_out
  const t=turnsOf(path);let best=null;
  for(let i=0;i<t.length;i++){const c=path[i+1];const din=V.nrm(V.sub(c,path[i])),dout=V.nrm(V.sub(path[i+2],c));
    for(const tt of [0.8,1.2,1.8,2.6]){if(V.dist(c,path[i+2])<tt+0.6)continue;const c1=V.add(c,V.mul(din,tt)),c2=V.add(c,V.mul(dout,tt));
      if(obsH.some(H=>segPolyDist(c,c1,H)<0.25-1e-9||segPolyDist(c1,c2,H)<0.25-1e-9))continue;
      const np=path.slice(0,i+1).concat([c1,c2],path.slice(i+2));const ok=creaseOK(np.slice(Math.max(0,i-1),Math.min(np.length,i+5)),0.05).ok;
      if(ok&&(!best||tt<best.tt))best={tt,np};if(ok)break;}}
  return best?best.np:null;}


/* =====================================================================================
   Strip state Φ: modules in visiting order, lexicographic order (lem:lex)
   ===================================================================================== */
function ropeModule(Xs,glo,path,rank0){
  // glo: global paper -> image for the lower half y<=1/2 near the start; returns faces, end X, end map
  const mu1={a:1,b:0,c:0,d:-1,e:0,f:1};const faces=[];let g=glo;let X=Xs;
  let prev={p:[Xs,0.25],d:[0,1]}; // vertical start cut
  const after=(cr,q)=>{const n=[cr.d[1],-cr.d[0]];const o=V.dot(n,V.sub([cr.p[0]+1e6,0.25],cr.p))>0?1:-1;return o*V.dot(n,V.sub(q,cr.p));};
  const n=path.length;let arc=0;let seg=0;
  for(let i=1;i<n;i++){arc+=V.dist(path[i-1],path[i]);const Xi=Xs+arc;let cr;
    let gnext=null;
    if(i<n-1){const din=V.nrm(V.sub(path[i],path[i-1])),dout=V.nrm(V.sub(path[i+1],path[i]));let lam=V.add(din,dout);
      lam=V.len(lam)<1e-9?V.perp(din):V.nrm(lam);const gi=I.inv(g);const pp=I.ap(gi,path[i]);const dd=V.nrm(I.lin(gi,lam));
      cr={p:pp,d:dd};gnext=I.comp(I.refl(path[i],V.add(path[i],lam)),g);}
    else cr={p:[Xi,0.25],d:[0,1]};
    // lower half region between prev and cr
    const xmin=Math.min(prev.p[0],cr.p[0])-60,xmax=Math.max(prev.p[0],cr.p[0])+60;let R=box(xmin,xmax,0,0.5);
    const hp=(cr0,sgn)=>{const nn=[cr0.d[1],-cr0.d[0]];const o=V.dot(nn,V.sub([cr0.p[0]+1e6,0.25],cr0.p))>0?1:-1;
      // after(q)>=0  <=>  -o*nn·q <= -o*nn·p ; before: o*nn·q <= o*nn·p
      const m=V.mul(nn,-o*sgn);return [m,V.dot(m,cr0.p)];};
    let c1=hp(prev,1),c2=hp(cr,-1);R=clipHP(clipHP(R,c1[0],c1[1]),c2[0],c2[1]);
    if(R.length&&Math.abs(area(R))>1e-12){const up=R.map(q=>[q[0],1-q[1]]).reverse();const gu=I.comp(g,mu1);
      const lowBottom=I.det(g)>0;
      faces.push({P:R,g,rank:rank0+2*seg+(lowBottom?0:1),rope:true});
      faces.push({P:up,g:gu,rank:rank0+2*seg+(lowBottom?1:0),rope:true});}
    seg++;prev=cr;if(gnext)g=gnext;X=Xi;}
  return {faces,Xe:X,gEnd:g,nrank:2*seg};}
function sameIso(g,h,t){return Math.abs(g.a-h.a)+Math.abs(g.b-h.b)+Math.abs(g.c-h.c)+Math.abs(g.d-h.d)+Math.abs(g.e-h.e)+Math.abs(g.f-h.f)<(t||1e-6);}
function chooseVer(fr,side){ // version whose rope corner is acute (keeps junk small)
  const phi=side==='in'?Math.atan2(fr.h,fr.xAL-fr.xBL):Math.atan2(fr.h,fr.xBR-fr.xAR);return phi<=Math.PI/2?'B':'A';}

function buildStrip(T,holes,opt){
  opt=Object.assign({w:1.5,autoW:true,gap:6,trials:12,seed:7,g:1.0,mcut:0.6,maxRows:4000,rowsOnly:false},opt||{});
  const t0=Date.now();const log=[];const snap=r=>r.map(p=>p.map(x=>Math.round(x*1e12)/1e12));T=T.map(snap);holes=(holes||[]).map(snap);
  const plan=planBase(T,holes,opt);const pieces=plan.B.pieces;
  {let best=null;for(let f=1;f<=2.2;f+=0.005){const b=badLevels(pieces,plan.lam*f);if(!best||b<best.b)best={b,f};if(b===0)break;}plan.lam*=best.f;plan.badLevels=best.b;}
  const lam=plan.lam;
  const rows=makeRows(pieces,lam);
  const res={plan,lam,pieces,rows,log,openings:plan.B.cfg.openings.map(o=>({p:V.mul(o.p,lam),d:o.d,w:o.w*lam})),
    Tscaled:plan.Tr.map(r=>r.map(q=>V.mul(q,lam))),Hscaled:plan.Hr.map(r=>r.map(q=>V.mul(q,lam))),info:plan.B.info};
  log.push(`w=${plan.w.toFixed(3)}, min end angle ${(plan.minA*180/Math.PI).toFixed(1)}°, margin ${plan.gapReq.toFixed(1)}, span ${plan.span.toFixed(0)}; bands: openings (0) ${plan.B.info.step0}, (i) ${plan.B.info.stepi}, (ii) ${plan.B.info.stepii} (skipped ${plan.B.info.stepiiSkipped}); pieces ${pieces.length}; λ=${lam.toFixed(2)} (near-degenerate row heights ${plan.badLevels}); rows ${rows.length}`);
  if(opt.rowsOnly||rows.length>opt.maxRows){res.tooBig=rows.length>opt.maxRows;res.ms=Date.now()-t0;return res;}
  // rows in visiting order, orientations (boustrophedon; a triangle row keeps side A toward e_H)
  const ord=visitOrder(pieces);const seq=[];
  for(const pi of ord){const P=pieces[pi];P.rows.forEach((ri,j)=>{let o=(j%2===0)?1:-1;let fr=rowFrame(rows[ri],o);if(fr.triA){o=1;fr=rowFrame(rows[ri],1);}
    if(j===0&&o!==1)throw new Error('row 1 must have side A on e_H');seq.push({ri,fr});});}
  const obs=pieces.map(P=>{const F=inflate(coarsen(P.H,0.3),0.25);return {H:P.H,F,bb:bbox(F)};});
  const obsH=pieces.map(P=>P.H);
  const strip=[];let rank=0;let modules=[];
  let vin=seq[0].fr.tri?'B':chooseVer(seq[0].fr,'in');
  let off=null;let curX=0;let stats={routes:0,turns:0,parityFix:0,crease:0,routeLen:0};
  const G=f=>f.G;
  for(let k=0;k<seq.length;k++){const S=seq[k],fr=S.fr;
    // choose exit version of this row and entry version of the next by routing all combinations
    let best=null;const dbg=[];
    const vouts=fr.tri?['B']:['B','A'];const nxt=k+1<seq.length?seq[k+1]:null;const vins=nxt?(nxt.fr.tri?['B']:['B','A']):[null];
    for(const vo of vouts)for(const vi of vins){
      const eo=endPort(fr,'out',vo,opt);const sP=I.ap(fr.G,I.ap(eo.lo,[eo.xcut,0.25])),sD=V.nrm(I.lin(fr.G,I.lin(eo.lo,[1,0])));
      const ks=Math.sign(I.det(I.comp(fr.G,eo.lo)));let eP,eD,ke,ei=null;
      if(nxt){ei=endPort(nxt.fr,'in',vi,opt);eP=I.ap(nxt.fr.G,I.ap(ei.lo,[ei.xcut,0.25]));eD=V.nrm(I.lin(nxt.fr.G,I.lin(ei.lo,[1,0])));ke=Math.sign(I.det(I.comp(nxt.fr.G,ei.lo)));}
      else{const bb=bbox(obs.flatMap(o=>o.F));eP=[bb[2]+8,bb[3]+8];eD=null;ke=null;}
      let path=null,fix=0,okRoute=false;
      for(const [S0,S1] of [[0.7,0.7],[1.5,1.5],[3,0.7],[0.7,3],[3,3],[6,6]]){
        let s0=S0,s1=nxt?S1:2;let p=null;
        for(let tr=0;tr<5;tr++){
          p=routePath(sP,sD,eP,eD||[1,0],obs,{s0,s1});if(!p)break;
          p=simplifyPath(p);p=killSmallTurns(p,obsH,0.2);p=mergeShort(p,obsH);
          const c=creaseOK(p,0.05);if(c.ok||c.where!=='end')break;
          const t=c.t;const e0=0.25*Math.abs(1/Math.tan(Math.abs(t[0])/2)),e1=0.25*Math.abs(1/Math.tan(Math.abs(t[t.length-1])/2));s0=Math.max(s0,e0+0.2);s1=Math.max(s1,e1+0.2);}
        if(!p){dbg.push(vo+vi+`:noroute(s0 ${S0})`);continue;}
        fix=0;
        if(nxt){const need=(ks!==ke)?1:0;if(turnsOf(p).length%2!==need){const np=addTurn(p,obsH)||addLoop(p,obsH);if(!np){dbg.push(vo+vi+":noparity "+turnsOf(p).map(x=>(x*180/Math.PI).toFixed(0)).join(","));continue;}p=np;fix=1;}}
        path=p;if(creaseOK(p,0.02).ok){okRoute=true;break;}}
      if(!path)continue;
      const cOK=creaseOK(path,0.02).ok;
      let L=0;for(let i=1;i<path.length;i++)L+=V.dist(path[i-1],path[i]);
      const sc=L+(cOK?0:1e6)+fix*0.5;
      if(!best||sc<best.sc)best={sc,vo,vi,eo,ei,path,L,fix,cOK};}
    if(!best)throw new Error('routing failed after row '+k+': '+dbg.join('; '));
    // row module k
    const ein=endPort(fr,'in',vin,opt);const M=rowModule(fr,vin,best.vo,opt);
    const Lr=linearize(M.faces,keyCmp);
    if(off===null)off=-M.x0;
    const mid=modules.length;
    for(let i=0;i<M.faces.length;i++){const F=M.faces[i];
      strip.push({P:F.P.map(q=>[q[0]+off,q[1]]),g:I.comp(I.comp(fr.G,F.g),I.tr([-off,0])),rank:rank+Lr.rank[i],mod:mid,row:S.ri,lab:F.lab,side:F.side});}
    rank+=M.faces.length;
    modules.push({type:'row',ri:S.ri,X0:off+M.x0,X1:off+M.x1,vin,vout:best.vo,nf:M.faces.length,h:fr.h,tri:fr.tri});
    // check: exit map from the row module equals the rope start
    const Xs=off+M.x1;const glo=I.comp(I.comp(fr.G,M.eout.lo),I.tr([-off,0]));
    const RM=ropeModule(Xs,glo,best.path,rank);rank+=RM.nrank;
    for(const F of RM.faces){F.mod=modules.length;strip.push(F);}
    modules.push({type:'rope',X0:Xs,X1:RM.Xe,nf:RM.faces.length,turns:turnsOf(best.path).length,fix:best.fix,creaseOK:best.cOK,path:best.path});
    stats.routes++;stats.turns+=turnsOf(best.path).length;stats.parityFix+=best.fix;stats.crease+=best.cOK?0:1;stats.routeLen+=best.L;
    if(nxt){const offN=RM.Xe-best.ei.xcut;const gReq=I.comp(I.comp(nxt.fr.G,best.ei.lo),I.tr([-offN,0]));
      if(!sameIso(gReq,RM.gEnd,1e-5+1e-8*(Math.abs(gReq.e)+Math.abs(gReq.f)))){const dd=["a","b","c","d","e","f"].map(k=>Math.abs(gReq[k]-RM.gEnd[k]));log.push(`WARNING: rope end map mismatch before row ${k+1} (max diff ${Math.max(...dd).toExponential(2)}, |t| ${Math.abs(gReq.e).toExponential(1)})`);}
      off=offN;vin=best.vi;}
    else{curX=RM.Xe;res.lastMap=RM.gEnd;}}
  // pad the strip to an odd integer length L=2m+1 (rope continued straight; lem:accordion)
  const m=Math.ceil((curX+1-1)/2);const L=2*m+1;
  if(L>curX+1e-9){const g=res.lastMap;const R=box(curX,L,0,0.5);const lowBottom=I.det(g)>0;const mu1={a:1,b:0,c:0,d:-1,e:0,f:1};
    strip.push({P:R,g,rank:rank+(lowBottom?0:1),mod:modules.length,rope:true},{P:R.map(q=>[q[0],1-q[1]]).reverse(),g:I.comp(g,mu1),rank:rank+(lowBottom?1:0),mod:modules.length,rope:true});
    rank+=2;modules.push({type:'pad',X0:curX,X1:L,nf:2});}
  // routing condition (lem:global): module images meet a piece only in the body of their own row
  {let viol=0;const pb=pieces.map(P=>bbox(P.H));
    for(const F of strip){const im=imgOf(F);const P=area(im)<0?im.slice().reverse():im;const b=bbox(P);
      for(let pi=0;pi<pieces.length;pi++){const c=pb[pi];if(c[0]>=b[2]||b[0]>=c[2]||c[1]>=b[3]||b[1]>=c[3])continue;
        const a=interArea(P,pieces[pi].H);if(a<1e-9)continue;
        if(F.row===undefined||rows[F.row].piece!==pi){viol++;continue;}
        const ar=interArea(P,rows[F.row].poly);if(a-ar>1e-7)viol++;}}
    stats.routeViolations=viol;log.push(`routing condition: ${viol} face(s) meet a foreign piece or row`);}
  res.L=L;res.m=m;res.strip=strip;res.modules=modules;res.stats=stats;res.seq=seq;
  log.push(`strip: L=${L} (m=${m}), modules ${modules.length}, faces ${strip.length}; routes ${stats.routes}, turns ${stats.turns}, parity fixes ${stats.parityFix}, crease-spacing problems ${stats.crease}`);
  res.ms=Date.now()-t0;return res;}


/* =====================================================================================
   Closings: lem:pleat in reverse opening order, on the strip state (paper Q unchanged)
   order N ≻ M ≻ F′, M reversed; the total order is kept as integer ranks
   ===================================================================================== */
function pleatOnce(faces,op){
  const d=V.nrm(op.d),n=[-d[1],d[0]],c0=V.dot(n,op.p),w=op.w;const rho=I.refl(op.p,V.add(op.p,d)),tr=I.tr(V.mul(n,-2*w));
  let R=0;for(const F of faces)if(F.rank>R)R=F.rank;const out=[];
  for(const F of faces){const g=F.g;let lo=Infinity,hi=-Infinity;for(const q of F.P){const v=V.dot(n,I.ap(g,q))-c0;if(v<lo)lo=v;if(v>hi)hi=v;}
    const tol=1e-9*(1+Math.abs(c0));
    if(hi<=tol){out.push({P:F.P,g,rank:2*(R+1)+F.rank,mod:F.mod,s:F.s});continue;}
    if(lo>=w-tol){out.push({P:F.P,g:I.comp(tr,g),rank:F.rank,mod:F.mod});continue;}
    const m=[n[0]*g.a+n[1]*g.c,n[0]*g.b+n[1]*g.d],k=n[0]*g.e+n[1]*g.f-c0; // x(p)=m·p+k
    const pN=clipHP(F.P,m,-k),pF=clipHP(F.P,[-m[0],-m[1]],k-w);let pM=clipHP(clipHP(F.P,[-m[0],-m[1]],k),m,w-k);
    if(pN.length&&Math.abs(area(pN))>1e-14)out.push({P:pN,g,rank:2*(R+1)+F.rank,mod:F.mod});
    if(pM.length&&Math.abs(area(pM))>1e-14)out.push({P:pM,g:I.comp(rho,g),rank:(R+1)+(R-F.rank),mod:F.mod});
    if(pF.length&&Math.abs(area(pF))>1e-14)out.push({P:pF,g:I.comp(tr,g),rank:F.rank,mod:F.mod});}
  // renormalise ranks
  const idx=out.map((_,i)=>i).sort((a,b)=>out[a].rank-out[b].rank);idx.forEach((i,k)=>{out[i].rank=k;});
  return out;}
function closeAll(strip,openings,onStep){
  let F=strip.map(f=>({P:f.P,g:f.g,rank:f.rank,mod:f.mod}));
  {const idx=F.map((_,i)=>i).sort((a,b)=>F[a].rank-F[b].rank);idx.forEach((i,k)=>{F[i].rank=k;});}
  for(let i=openings.length-1;i>=0;i--){F=pleatOnce(F,openings[i]);if(onStep)onStep(openings.length-i,F.length);}
  return F;}


/* =====================================================================================
   Crease pattern of a face set (paper), and the app-level pipeline
   ===================================================================================== */
function inConvex(P,q,t){for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length];if((b[0]-a[0])*(q[1]-a[1])-(b[1]-a[1])*(q[0]-a[0])<-t)return false;}return true;}
function creasesOf(faces){ // [{a,b,mv:'M'|'V'|'B'}] ; B = raw boundary
  const P=faces.map(F=>area(F.P)<0?F.P.slice().reverse():F.P);const bb=P.map(bbox);let W=0;for(const b of bb)W+=Math.max(b[2]-b[0],b[3]-b[1]);
  const cs=Math.max(W/Math.max(1,P.length)*2,1e-6);const grid=new Map();
  P.forEach((Q,i)=>{const b=bb[i];for(let x=Math.floor(b[0]/cs);x<=Math.floor(b[2]/cs);x++)for(let y=Math.floor(b[1]/cs);y<=Math.floor(b[3]/cs);y++){const k=x+','+y;if(!grid.has(k))grid.set(k,[]);grid.get(k).push(i);}});
  const find=(q,ex)=>{const L=grid.get(Math.floor(q[0]/cs)+','+Math.floor(q[1]/cs));if(!L)return -1;for(const j of L)if(j!==ex&&inConvex(P[j],q,1e-12))return j;return -1;};
  const out=[];
  P.forEach((Q,i)=>{for(let k=0;k<Q.length;k++){const a=Q[k],b=Q[(k+1)%Q.length];const L=V.dist(a,b);if(L<1e-9)continue;
      const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];const no=[(b[1]-a[1])/L,-(b[0]-a[0])/L];const q=V.add(mid,V.mul(no,1e-7));
      const j=find(q,i);if(j<0){out.push({a,b,mv:'B'});continue;}if(j<i)continue;
      const gi=faces[i].g,gj=faces[j].g;if(sameIso(gi,gj,1e-7))continue;
      const up=faces[i].rank>faces[j].rank?faces[i]:faces[j];out.push({a,b,mv:I.det(up.g)<0?'V':'M'});}});
  return out;}
// sampled sanity check of a closed state: n = χ_T and the colour of the top face (not a full check)
function sampleCheck(faces,T,H,K){
  const imgs=faces.map(F=>{const P=imgOf(F);return area(P)<0?P.slice().reverse():P;});const bb=bbox(T.flat());
  const pad=0.15*Math.max(bb[2]-bb[0],bb[3]-bb[1]);const B=[bb[0]-pad,bb[1]-pad,bb[2]+pad,bb[3]+pad];
  const N=64,cw=(B[2]-B[0])/N,ch=(B[3]-B[1])/N;const grid=[...Array(N*N)].map(()=>[]);
  imgs.forEach((P,i)=>{const b=bbox(P);for(let x=Math.max(0,Math.floor((b[0]-B[0])/cw));x<=Math.min(N-1,Math.floor((b[2]-B[0])/cw));x++)
    for(let y=Math.max(0,Math.floor((b[1]-B[1])/ch));y<=Math.min(N-1,Math.floor((b[3]-B[1])/ch));y++)grid[x*N+y].push(i);});
  const inRing=(R,q)=>{let c=false;for(let i=0,j=R.length-1;i<R.length;j=i++){const a=R[i],b=R[j];if(((a[1]>q[1])!==(b[1]>q[1]))&&(q[0]<(b[0]-a[0])*(q[1]-a[1])/(b[1]-a[1])+a[0]))c=!c;}return c;};
  const rnd=mulberry(12345);let badN=0,badTop=0,badBot=0,n=0;
  for(let k=0;k<K;k++){const q=[B[0]+rnd()*(B[2]-B[0]),B[1]+rnd()*(B[3]-B[1])];
    const inT=T.some(R=>inRing(R,q))&&!H.some(R=>inRing(R,q));
    let w=0,top=-1,bot=-1;for(const i of grid[Math.min(N-1,Math.floor((q[0]-B[0])/cw))*N+Math.min(N-1,Math.floor((q[1]-B[1])/ch))]){
      if(!inConvex(imgs[i],q,0))continue;w+=Math.sign(I.det(faces[i].g));if(top<0||faces[i].rank>faces[top].rank)top=i;if(bot<0||faces[i].rank<faces[bot].rank)bot=i;}
    n++;if(w!==(inT?1:0))badN++;if(top>=0&&(I.det(faces[top].g)>0)!==inT)badTop++;if(inT&&top<0)badTop++;if(bot>=0&&I.det(faces[bot].g)<0)badBot++;}
  return {n,badN,badTop,badBot};}
function stripMethod(T,holes,opt){
  opt=Object.assign({w:3,gap:6,trials:40,maxRows:3000,close:true,skipI:true,randLines:true},opt||{});
  const R=buildStrip(T,holes,opt);
  const out={ok:true,log:R.log,lam:R.lam,info:R.info,nOpen:R.openings.length,
    T:R.Tscaled,H:R.Hscaled,rows:R.rows.map(r=>r.poly),pieces:R.pieces.map(P=>({poly:P.H,owned:P.owned.map(i=>[P.H[i],P.H[(i+1)%P.H.length]]),base:P.baseEdge})),
    angle:R.plan.ang,tooBig:!!R.tooBig,nRows:R.rows.length,ms:{build:R.ms}};
  if(R.tooBig||!R.strip)return out;
  out.ropes=R.modules.filter(m=>m.type==='rope').map(m=>m.path);out.L=R.L;out.m=R.m;out.stats=R.stats;
  out.nStripFaces=R.strip.length;
  let t=Date.now();out.stripCP=creasesOf(R.strip).filter(c=>c.mv!=='B').map(c=>[c.a[0],c.a[1],c.b[0],c.b[1],c.mv==='M'?1:2]);out.ms.cp=Date.now()-t;
  // unfolded-state image (base configuration, strip state Φ)
  const ord=R.strip.map((_,i)=>i).sort((a,b)=>R.strip[a].rank-R.strip[b].rank);
  out.phiImage=ord.map(i=>{const F=R.strip[i];return [imgOf(F),I.det(F.g)>0?1:0];});
  if(opt.close){t=Date.now();const C=closeAll(R.strip,R.openings);out.ms.close=Date.now()-t;out.nClosed=C.length;
    const o2=C.map((_,i)=>i).sort((a,b)=>C[a].rank-C[b].rank);out.folded=o2.map(i=>[imgOf(C[i]),I.det(C[i].g)>0?1:0]);
    t=Date.now();out.closedCP=creasesOf(C).filter(c=>c.mv!=='B').map(c=>[c.a[0],c.a[1],c.b[0],c.b[1],c.mv==='M'?1:2]);out.ms.cp2=Date.now()-t;
    out.sample=sampleCheck(C,R.Tscaled,R.Hscaled,opt.samples||3000);
    if(opt.keepState)out.state={strip:R.strip,closed:C,L:R.L,T:R.Tscaled,H:R.Hscaled};}
  return out;}
// square crease pattern from the strip crease pattern (lem:accordion): layer k is [0,L]x[k,k+1]
function squareCP(stripCP,m,limit){
  const L=2*m+1,out=[];for(let k=0;k<L;k++){const odd=k%2===1;
    for(const [x1,y1,x2,y2,mv] of stripCP){if(limit&&out.length>limit)return {segs:out,truncated:true,L};
      out.push([x1,odd?k+1-y1:k+y1,x2,odd?k+1-y2:k+y2,odd?3-mv:mv]);}}
  for(let k=1;k<L;k++)out.push([0,k,L,k,(k-1)%2===0?2:1]);
  return {segs:out,truncated:false,L};}

return {sampleCheck,stripMethod,squareCP,creasesOf,closeAll,pleatOnce,buildStrip,ropeModule,planBase,makeRows,rowFrame,visitOrder,inflate,routePath,turnsOf,creaseOK,mergeShort,addTurn,imgOf,overlapPairs,linearize,toChecker,kappa,entryCanonical,endPort,rowModule,keyCmp,tfFace,V,I,area,ccw,clipHP,clipConvex,interArea,hull,cleanPoly,bbox,centroid,segHitsConvex,segPolyDist,ptSeg,mulberry,Config,bands,finalPieces};
})();
