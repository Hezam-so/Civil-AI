'use strict';
/** Nearest mapped road centreline to parcel boundary, with orientation and confidence hints.
 * Approximate local east/north in metres. Only a classified road is rendered.
 */
(function(root,factory){
 const api=factory();
 if(root)root.CivilStreetEdges=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:null,function(){
 const R=6371008.8,rad=Math.PI/180;
 const sides=['شمال','شرق','جنوب','غرب'];
 function project(p,origin){
  const dx=((p.lng-origin.lng+540)%360)-180;
  return{x:R*Math.cos(origin.lat*rad)*dx*rad,y:R*(p.lat-origin.lat)*rad};
 }
 function dot(a,b){return a.x*b.x+a.y*b.y}
 function subtract(a,b){return{x:a.x-b.x,y:a.y-b.y}}
 function nearestPoint(p,a,b){
  const v=subtract(b,a),den=dot(v,v),t=den>0?Math.max(0,Math.min(1,dot(subtract(p,a),v)/den)):0;
  return{x:a.x+v.x*t,y:a.y+v.y*t};
 }
 function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
 function sideFromPoint(p,c){
  const delta=subtract(p,c);
  return Math.abs(delta.x)>Math.abs(delta.y)?delta.x>=0?'شرق':'غرب':delta.y>=0?'شمال':'جنوب';
 }
 function closest(road,parcel){
  const origin=parcel[0],pol=parcel.map(p=>project(p,origin)),rd=road.map(p=>project(p,origin));
  const centroid=pol.reduce((a,b)=>({x:a.x+b.x/pol.length,y:a.y+b.y/pol.length}),{x:0,y:0});
  let best={distance:Infinity,point:null};
  for(let i=0;i<rd.length-1;i++){
   const a=rd[i],b=rd[i+1];
   for(let j=0;j<pol.length;j++){
    const c=pol[j],d=pol[(j+1)%pol.length];
    const comparisons=[
     {point:a,other:nearestPoint(a,c,d)},
     {point:b,other:nearestPoint(b,c,d)},
     {point:nearestPoint(c,a,b),other:c},
     {point:nearestPoint(d,a,b),other:d}
    ];
    for(const comp of comparisons){
     const distance=dist(comp.point,comp.other);
     if(distance<best.distance)best={distance,point:comp.point};
    }
   }
  }
  if(!Number.isFinite(best.distance))return null;
  return{distance:best.distance,side:sideFromPoint(best.point,centroid),point:best.point};
 }
 function classify(roads,parcel,{maxDistance=55,maxRoads=8}={}){
  if(!Array.isArray(parcel)||parcel.length<3)return[];
  const records=[];
  for(const road of (Array.isArray(roads)?roads:[])){
   if(!Array.isArray(road.points)||road.points.length<2)continue;
   const r=closest(road.points,parcel);
   if(!r||r.distance>maxDistance)continue;
   records.push({...road,side:r.side,distanceFromBoundary:Number(r.distance.toFixed(1))});
  }
  // Only closest roads are retained; roads too distant from the parcel are excluded.
  records.sort((a,b)=>a.distanceFromBoundary-b.distanceFromBoundary);
  const counts={};const filtered=[];
  for(const road of records){
   if((counts[road.side]||0)>=2)continue;
   filtered.push(road);counts[road.side]=(counts[road.side]||0)+1;
   if(filtered.length>=maxRoads)break;
  }
  return filtered;
 }
 function sideLabels(roads,manual=[]){
  const bySide={};
  for(const road of roads||[]){
   const side=road.side;
   if(!sides.includes(side))continue;
   const name=String(road.name||'شارع غير مسمى').slice(0,65);
   (bySide[side]??=[]).push(name);
  }
  for(const side of manual||[]){
   if(!sides.includes(side))continue;
   (bySide[side]??=[]).push('شارع - جهة يدوية');
  }
  return bySide;
 }
 return{classify,sideLabels,project};
});