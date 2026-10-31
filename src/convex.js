/* ============================================================
   Convex-paper boundary assignment (port of core/convex.js, same order/semantics)
   Paper = regular m-gon (tri/square/pent/hex), unit side scaled by lambda, centred at origin.
   lambda = fixed point of  lambda >= max(D/hhat, (Q + 2 m rho(beta) D)/lhat)
   (square: W >= max(D, Q/4 + (sqrt2-1) D) — the sharp bound).
   ============================================================ */
function cvRegular(m){const V=[];for(let k=0;k<m;k++){const a=-Math.PI/2+Math.PI/m+2*Math.PI*k/m;V.push([Math.cos(a),Math.sin(a)]);}
  const s=dist(V[0],V[1]);return V.map(p=>mul(p,1/s));}
const CV_KINDS={tri:3,square:4,pent:5,hex:6};
function* candidatesConvex(Ts,H,kind,nC,wScale){
  nC=nC||20;H=H||[];wScale=wScale||1;
  const PH=cvRegular(CV_KINDS[kind]);const m=PH.length;
  const ang=k=>{const a=PH[(k-1+m)%m],b=PH[k],c=PH[(k+1)%m];const u=sub(a,b),v=sub(c,b);return Math.acos((u[0]*v[0]+u[1]*v[1])/(Math.hypot(...u)*Math.hypot(...v)));};
  const rho=b=>(1-Math.sin(b/2))/(2*Math.sin(b/2));
  const beta=ang(0),hhat=(m===3)?Infinity:1,ehat=1,lhat=m;
  const L0=buildL0(null,Ts.map(t=>t.map(p=>[...p])),H.map(t=>t.map(p=>[...p])));
  const cum0=cumulative(L0),Q=cum0[cum0.length-1];
  let D0=0;for(const a of L0)for(const b of L0)D0=Math.max(D0,dist(a,b));
  const pointAt=s=>{s=((s%Q)+Q)%Q;for(let i=0;i<L0.length;i++){const a=L0[i],b=L0[(i+1)%L0.length],e=dist(a,b);if(s<=cum0[i]+e+1e-12){const t=e<1e-15?0:(s-cum0[i])/e;return [add(a,mul(sub(b,a),Math.min(1,Math.max(0,t)))),i];}}return [L0[0],0];};
  function pathL0(s0,s1){
    const pts=[pointAt(s0)[0]];
    const Ls=[];for(let i=0;i<L0.length;i++)Ls.push(cum0[i]);
    const base=Math.floor(s0/Q)*Q;
    for(let w=0;w<3;w++)for(let i=0;i<L0.length;i++){const s=base+w*Q+Ls[i];if(s>s0+1e-12&&s<s1-1e-12)pts.push([...L0[i]]);}
    pts.push(pointAt(s1)[0]);return pts;}
  function spurDir(bp,r,placed){
    const best=[];
    for(let k=0;k<72;k++){const a=2*Math.PI*k/72,d=[Math.cos(a),Math.sin(a)],tip=add(bp,mul(d,r));
      let ok=true;
      for(let i=0;i<L0.length&&ok;i++){const p=L0[i],q=L0[(i+1)%L0.length];if(dist(p,bp)<1e-9||dist(q,bp)<1e-9)continue;
        const s=segInt(bp,tip,p,q);if(s&&s[0]>1e-7&&s[0]<1-1e-7&&s[1]>-1e-9&&s[1]<1+1e-9)ok=false;}
      for(const sp of placed){const s=segInt(bp,tip,sp.bp,sp.tip);if(s&&s[0]>-1e-9&&s[0]<1+1e-9&&s[1]>-1e-9&&s[1]<1+1e-9)ok=false;}
      if(!ok)continue;
      let inT=false;for(const t of Ts)if(pointInPoly(t,add(bp,mul(d,r*0.999)))&&pointInPoly(t,add(bp,mul(d,r*0.5))))inT=true;
      for(const h of H)if(pointInPoly(h,add(bp,mul(d,r*0.5))))inT=false;
      let dd=0;for(const p of L0)dd=Math.max(dd,dist(p,tip));
      best.push([(inT?0:10)+dd,d]);}
    best.sort((x,y)=>x[0]-y[0]);return best.length?best[0][1]:null;}
  function build(lam,phase){
    const rsum=(lam*lhat-Q)/2,r=rsum/m;
    if(r<0)return null;
    const sec=lam*ehat-2*r;if(sec<0)return null;
    const bases=[];for(let k=0;k<m;k++)bases.push(phase+k*sec);
    const placed=[];
    for(let k=0;k<m;k++){const [bp]=pointAt(bases[k]);const d=spurDir(bp,r,placed);if(!d)return null;placed.push({bp,tip:add(bp,mul(d,r))});}
    const V=[],F=[];const Pc=PH.map(p=>mul(p,lam));
    for(let k=0;k<m;k++){
      const A=Pc[k],B=Pc[(k+1)%m],u=mul(sub(B,A),1/dist(A,B));
      const img=[placed[k].tip,placed[k].bp,...pathL0(bases[k],bases[k]+sec).slice(1,-1),pointAt(bases[k]+sec)[0],placed[(k+1)%m].tip];
      let s=0;const seq=[[0,img[0]]];
      for(let i=1;i<img.length;i++){s+=dist(img[i-1],img[i]);seq.push([s,img[i]]);}
      for(let i=0;i<seq.length-1;i++){if(i>0&&seq[i][0]-seq[i-1][0]<1e-12)continue;V.push(add(A,mul(u,seq[i][0])));F.push(seq[i][1]);}
    }
    let D=0;for(const p of F)for(const q of F)D=Math.max(D,dist(p,q));
    return {V,F,D,r};
  }
  const need=D=>Math.max(m>=4?D/hhat:0,(Q+2*m*rho(beta)*D)/lhat);
  const seen=new Set();let count=0;
  for(const ph of OV_PHASES){
    let lam=need(D0),res=null;
    for(let it=0;it<60;it++){res=build(lam,ph*Q);if(!res){lam*=1.02;continue;}const nl=need(res.D);if(nl<=lam*(1+1e-12))break;lam=nl;}
    if(wScale!==1){lam*=wScale;for(let it=0;it<60;it++){res=build(lam,ph*Q);if(res&&need(res.D)<=lam*(1+1e-12))break;lam*=1.02;}}
    res=build(lam,ph*Q);if(!res)continue;
    for(let seed=0;seed<4;seed++){
      setGeoTol(lam);
      let f=null;try{f=solveFaces(res.V.map(p=>[...p]),res.F.map(p=>[...p]),[],0,seed?{flipBranch:seed%2==1}:{});}catch(e){continue;}
      const area=Math.abs(signedArea(res.V));const tile=f.reduce((t,x)=>t+Math.abs(signedArea(x.V)),0)/area;
      if(Math.abs(tile-1)>1e-6)continue;
      const sig=f.map(x=>x.V.flat().map(v=>v.toFixed(5)).join(',')).sort().join(';');
      if(seen.has(sig))continue;seen.add(sig);
      yield {T:Ts,holes:H,W:lam,paper:PH.map(p=>mul(p,lam)),paperKind:kind,Q,r:res.r,phase:ph,seed,bV:res.V,bF:res.F,D:res.D,
             rho:rho(beta),index:count++,faces:f.map(x=>({V:x.V,F:x.F,s:faceSigma(x)}))};
    }
    if(count>=nC)return;
  }
}
