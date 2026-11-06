'use strict';
/* Pure planar survey geometry. No DOM, browser storage or network calls. */
(function(root,factory){
 const api=factory();
 if(root)root.CivilLandGeometry=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:null,function(){
 const EPS=1e-12;
 function cross(a,b,c){return(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)}
 function signArea(points){
   // Translate to the first vertex so large Easting/Northing survey coordinates retain precision.
   const p=points.map(v=>({x:v.x-points[0].x,y:v.y-points[0].y}));
   let sum=0,correction=0;
   for(let i=0;i<p.length;i++){
     const q=p[(i+1)%p.length],term=p[i].x*q.y-q.x*p[i].y;
     const y=term-correction,t=sum+y;correction=(t-sum)-y;sum=t;
   }
   return sum/2;
 }
 function onSegment(a,p,b,e){
   return Math.abs(cross(a,p,b))<=e&&
    p.x>=Math.min(a.x,b.x)-e&&p.x<=Math.max(a.x,b.x)+e&&
    p.y>=Math.min(a.y,b.y)-e&&p.y<=Math.max(a.y,b.y)+e;
 }
 function segmentsTouch(a,b,c,d,eps){
   const o1=cross(a,b,c),o2=cross(a,b,d),o3=cross(c,d,a),o4=cross(c,d,b);
   if(((o1>eps&&o2< -eps)||(o1< -eps&&o2>eps))&&
      ((o3>eps&&o4< -eps)||(o3< -eps&&o4>eps)))return true;
   return (Math.abs(o1)<=eps&&onSegment(a,c,b,eps))||
    (Math.abs(o2)<=eps&&onSegment(a,d,b,eps))||
    (Math.abs(o3)<=eps&&onSegment(c,a,d,eps))||
    (Math.abs(o4)<=eps&&onSegment(c,b,d,eps));
 }
 function inTriangle(p,a,b,c,orientation,eps){
   const u=orientation*cross(a,b,p),v=orientation*cross(b,c,p),w=orientation*cross(c,a,p);
   return u>=-eps&&v>=-eps&&w>=-eps;
 }
 function triangulate(points,eps,orientation){
   const indices=points.map((_,i)=>i),triangles=[];
   let iterations=0;
   while(indices.length>3&&iterations<points.length*points.length){
     let clipped=false;
     for(let k=0;k<indices.length;k++){
       const ia=indices[(k+indices.length-1)%indices.length],ib=indices[k],ic=indices[(k+1)%indices.length];
       const a=points[ia],b=points[ib],c=points[ic];
       if(orientation*cross(a,b,c)<=eps)continue;
       if(indices.some(id=>id!==ia&&id!==ib&&id!==ic&&inTriangle(points[id],a,b,c,orientation,eps)))continue;
       triangles.push([ia,ib,ic]);indices.splice(k,1);clipped=true;break;
     }
     if(!clipped)return [];
     iterations++;
   }
   if(indices.length===3)triangles.push(indices.slice());
   return triangles;
 }
 function polygonArea(raw){
   if(!Array.isArray(raw)||raw.length<3)return {valid:false,error:'vertices',detail:'At least three points are needed.'};
   if(raw.length>100)return {valid:false,error:'limit',detail:'Maximum 100 vertices.'};
   const points=raw.map(p=>({x:Number(p.x),y:Number(p.y)}));
   if(points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x)>1e10||Math.abs(p.y)>1e10))
     return {valid:false,error:'coordinates',detail:'All X/Y coordinates must be finite metre values.'};
   const x0=points[0].x,y0=points[0].y;
   const relative=points.map(p=>({x:p.x-x0,y:p.y-y0}));
   const xs=relative.map(p=>p.x),ys=relative.map(p=>p.y);
   const span=Math.max(...xs)-Math.min(...xs),rise=Math.max(...ys)-Math.min(...ys);
   const len=Math.max(span,rise);
   const edgeTol=Math.max(1e-9,len*1e-12),areaTol=Math.max(1e-13,len*len*EPS);
   let perimeter=0;
   for(let i=0;i<relative.length;i++){
     const a=relative[i],b=relative[(i+1)%relative.length],distance=Math.hypot(b.x-a.x,b.y-a.y);
     if(distance<=edgeTol)return {valid:false,error:'duplicate',detail:'Adjacent vertices coincide.'};
     perimeter+=distance;
   }
   for(let i=0;i<relative.length;i++){
     const a=relative[i],b=relative[(i+1)%relative.length];
     for(let j=i+1;j<relative.length;j++){
       if(j===i+1||(i===0&&j===relative.length-1))continue;
       const c=relative[j],d=relative[(j+1)%relative.length];
       if(segmentsTouch(a,b,c,d,areaTol))
         return {valid:false,error:'crossing',detail:'The boundary crosses or touches itself.'};
     }
   }
   const signed=signArea(relative),area=Math.abs(signed);
   if(area<=areaTol)return {valid:false,error:'zero',detail:'The polygon has no measurable planar area.'};
   const triangles=triangulate(relative,areaTol,Math.sign(signed));
   // Ear-clipping is for visualization only; the authoritative area is shoelace.
   return {valid:true,area,perimeter,points,triangles,areaByTriangles:triangles.reduce((s,t)=>s+Math.abs(cross(relative[t[0]],relative[t[1]],relative[t[2]]))/2,0)};
 }
 function triangleSides(a,b,c){
   [a,b,c]=[Number(a),Number(b),Number(c)];
   if(![a,b,c].every(x=>Number.isFinite(x)&&x>0&&x<=1e10))return {valid:false,error:'sides'};
   const sides=[a,b,c].sort((x,y)=>y-x),[largest,middle,smallest]=sides;
   if(middle+smallest<=largest)return {valid:false,error:'inequality'};
   const semi=(a+b+c)/2;
   // Kahan rearrangement of Heron's formula helps with narrow triangles.
   const product=(largest+(middle+smallest))*(smallest-(largest-middle))*(smallest+(largest-middle))*(largest+(middle-smallest));
   const area=.25*Math.sqrt(Math.max(0,product));
   if(!Number.isFinite(area)||area<=0)return {valid:false,error:'degenerate'};
   return {valid:true,area,perimeter:a+b+c,sides:{a,b,c},semiperimeter:semi};
 }
 return {polygonArea,triangleSides};
});
