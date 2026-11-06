'use strict';
/** Independent WGS84-coordinate boundary validation and spherical geodesic estimation.
 * Areas are approximate and based on the authalic Earth radius, not cadastral survey.
 */
(function(root,factory){
 const api=factory();
 if(root)root.CivilSatelliteGeometry=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:null,function(){
 const R=6371008.8,DEG=Math.PI/180;
 function deltaLon(a,b){
  let d=b-a;
  while(d>180)d-=360;
  while(d< -180)d+=360;
  return d;
 }
 function distance(a,b){
  const lat1=a.lat*DEG,lat2=b.lat*DEG,dphi=(b.lat-a.lat)*DEG,dl=deltaLon(a.lng,b.lng)*DEG;
  const k=Math.sin(dphi/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dl/2)**2;
  return 2*R*Math.asin(Math.min(1,Math.sqrt(k)));
 }
 function cross(a,b,c){return(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)}
 function between(a,b,p){return p.x>=Math.min(a.x,b.x)-1e-8&&p.x<=Math.max(a.x,b.x)+1e-8&&p.y>=Math.min(a.y,b.y)-1e-8&&p.y<=Math.max(a.y,b.y)+1e-8}
 function intersects(a,b,c,d){
  const u=cross(a,b,c),v=cross(a,b,d),w=cross(c,d,a),t=cross(c,d,b),eps=1e-7;
  if(((u>eps&&v< -eps)||(u< -eps&&v>eps))&&((w>eps&&t< -eps)||(w< -eps&&t>eps)))return true;
  return (Math.abs(u)<=eps&&between(a,b,c))||(Math.abs(v)<=eps&&between(a,b,d))||(Math.abs(w)<=eps&&between(c,d,a))||(Math.abs(t)<=eps&&between(c,d,b));
 }
 function validate(coords){
  if(!Array.isArray(coords)||coords.length<3||coords.length>100)return{valid:false,reason:'يجب تحديد 3–100 زوايا.'};
  const p=coords.map(c=>({lat:Number(c.lat),lng:Number(c.lng)}));
  if(p.some(c=>!Number.isFinite(c.lat)||!Number.isFinite(c.lng)||Math.abs(c.lat)>85||Math.abs(c.lng)>180))return{valid:false,reason:'إحداثيات غير صالحة؛ خط العرض بين −85° و85°، وخط الطول بين −180° و180°.'};
  const origin=p[0],centerLat=p.reduce((s,c)=>s+c.lat,0)/p.length;
  const xy=p.map(c=>({x:R*Math.cos(centerLat*DEG)*deltaLon(origin.lng,c.lng)*DEG,y:R*(c.lat-origin.lat)*DEG}));
  const dx=Math.max(...xy.map(c=>c.x))-Math.min(...xy.map(c=>c.x));
  const dy=Math.max(...xy.map(c=>c.y))-Math.min(...xy.map(c=>c.y));
  if(Math.max(dx,dy)>100000)return{valid:false,reason:'المخطط واسع جدًا (أكثر من 100 كم). استخدم قطع أراضٍ أصغر.'};
  const edges=[];
  for(let i=0;i<p.length;i++){
   const j=(i+1)%p.length,d=distance(p[i],p[j]);
   if(d<0.01)return{valid:false,reason:'توجد زاويتان متطابقتان أو ضلع أقل من سنتيمتر.'};
   edges.push(d);
  }
  for(let i=0;i<p.length;i++){
   for(let j=i+1;j<p.length;j++){
    if(j===i+1||(i===0&&j===p.length-1))continue;
    if(intersects(xy[i],xy[(i+1)%p.length],xy[j],xy[(j+1)%p.length]))
      return{valid:false,reason:'حدود القطعة متقاطعة. غيّر ترتيب الزوايا أو مواقعها.'};
   }
  }
  // Spherical surface integral of sin(latitude) along linear lon-lat edges.
  // Compensated summation and modulo-delta longitude to reduce cancellation.
  let sum=0,compensation=0;
  for(let i=0;i<p.length;i++){
   const a=p[i],b=p[(i+1)%p.length];
   const term=deltaLon(a.lng,b.lng)*DEG*(Math.sin(a.lat*DEG)+Math.sin(b.lat*DEG));
   const y=term-compensation,t=sum+y;compensation=(t-sum)-y;sum=t;
  }
  const area=Math.abs(sum)*R*R/2;
  if(!Number.isFinite(area)||area<0.01)return{valid:false,reason:'المساحة صفر أو صغيرة جدًا؛ راجع مواقع النقاط.'};
  return {valid:true,area,perimeter:edges.reduce((a,b)=>a+b,0),edges,points:p};
 }
 return {validate,distance,deltaLon,earthRadius:R};
});