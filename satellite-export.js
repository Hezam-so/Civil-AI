'use strict';
/* Civil AI: editable AutoCAD DXF 2007 and Arabic-labelled A4 landscape PDF for user-drawn satellite site plans.
   Coordinates use a local metre plane relative to plot point P1. Geodetic area stays the source-of-truth.
   The satellite imagery itself is not included: third-party tiles cannot be redistributed in these exports. */
(function(root,factory){
 const api=factory();
 if(root)root.CivilSatelliteExport=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:null,function(){
 const R=6371008.8,D=Math.PI/180;
 const round=n=>Number(n.toFixed(5));
 const escPdf=s=>String(s).replace(/[^\x20-\x7E]/g,'?').replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
 function safeRoads(roads){
  return (Array.isArray(roads)?roads:[]).slice(0,70).map((r,i)=>({
   name:typeof r.name==='string'?r.name.slice(0,80):'Road '+(i+1),
   source:r.source==='OpenStreetMap'?'OpenStreetMap':'manual',
   width:Number.isFinite(Number(r.width))&&Number(r.width)>0&&Number(r.width)<=100?Number(r.width):null,
   points:(Array.isArray(r.points)?r.points:[]).slice(0,100).map(p=>({lat:Number(p.lat),lng:Number(p.lng)}))
  })).filter(r=>r.points.length>=2&&r.points.every(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&Math.abs(p.lat)<=85&&Math.abs(p.lng)<=180));
 }
 function normalize(data,geom){
  if(!geom||typeof geom.validate!=='function')throw Error('Geometry library missing');
  const result=geom.validate(data?.points);
  if(!result.valid)throw Error(result.reason||'Invalid parcel boundary');
  const origin=result.points[0],roadData=safeRoads(data.roads);
  const lonDelta=(a,b)=>geom.deltaLon?geom.deltaLon(a,b):b-a;
  const toXY=p=>({x:R*Math.cos(origin.lat*D)*lonDelta(origin.lng,p.lng)*D,y:R*(p.lat-origin.lat)*D});
  const parcel=result.points.map(toXY);
  const roads=roadData.map((road,i)=>({...road,index:i+1,xy:road.points.map(toXY)}));
  for(const road of roads)if(road.xy.some(p=>Math.hypot(p.x,p.y)>100000))
   throw Error('Street is farther than 100 km from the parcel; remove distant road points.');
  const all=parcel.concat(...roads.map(r=>r.xy));
  const xs=all.map(p=>p.x),ys=all.map(p=>p.y);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const range=Math.max(maxX-minX,maxY-minY,1);
  return{parcel,roads,origin,minX,maxX,minY,maxY,range,area:result.area,perimeter:result.perimeter,edges:result.edges,title:String(data.title||'Satellite Parcel').slice(0,100)};
 }
 function createDXF(data,geom){
  const m=normalize(data,geom),lines=[];
  const write=(...v)=>lines.push(...v.map(String));
  const pair=(k,v)=>write(k,v);
  const layers=[['PARCEL',2],['ROAD_CENTER',4],['OSM_ROADS',6],['CORNERS',1],['DIMENSIONS',3],['NORTH',5],['ANNOTATIONS',7]];
  write('0','SECTION','2','HEADER','9','$ACADVER','1','AC1021','9','$INSUNITS','70','6','0','ENDSEC',
    '0','SECTION','2','TABLES','0','TABLE','2','LAYER','70',String(layers.length));
  layers.forEach(([name,col])=>write('0','LAYER','2',name,'70','0','62',String(col),'6','CONTINUOUS'));
  write('0','ENDTAB',
    '0','TABLE','2','STYLE','70','1',
    '0','STYLE','2','ARABIC','70','0','40','0','41','1','50','0','71','0','42','1','3','arial.ttf','4','',
    '0','ENDTAB',
    '0','ENDSEC','0','SECTION','2','ENTITIES');
  const coord=p=>['10',round(p.x),'20',round(p.y),'30','0'];
  const polyline=(pts,layer,closed)=>{
   write('0','POLYLINE','8',layer,'66','1','70',closed?'1':'0','10','0','20','0','30','0');
   pts.forEach(p=>write('0','VERTEX','8',layer,...coord(p)));
   write('0','SEQEND','8',layer);
  };
  const line=(a,b,layer)=>write('0','LINE','8',layer,...coord(a),'11',round(b.x),'21',round(b.y),'31','0');
  const text=(value,p,size,layer,angle=0)=>{
   write('0','TEXT','8',layer,...coord(p),'40',round(size),'1',String(value).replace(/[\r\n\u0000]/g,' ').slice(0,190),'50',round(angle),'7','ARABIC');
  };
  polyline(m.parcel,'PARCEL',true);
  const charSize=Math.max(.6,Math.min(3,m.range*.025));
  m.parcel.forEach((p,i)=>{
   const q=m.parcel[(i+1)%m.parcel.length];
   write('0','POINT','8','CORNERS',...coord(p));
   text('P'+(i+1),{x:p.x+charSize*.35,y:p.y+charSize*.35},charSize,'CORNERS');
   text(m.edges[i].toFixed(2)+' م',{x:(p.x+q.x)/2,y:(p.y+q.y)/2+charSize*.45},charSize*.75,'DIMENSIONS');
  });
  m.roads.forEach(road=>{
   polyline(road.xy,road.source==='OpenStreetMap'?'OSM_ROADS':'ROAD_CENTER',false);
   const center=road.xy[Math.floor(road.xy.length/2)];
   const name=road.name||'شارع '+road.index;
   text(name+(road.width?' - العرض '+road.width+' م':''),{x:center.x+charSize,y:center.y+charSize},charSize*.85,'ANNOTATIONS');
  });
  const nx=m.maxX+m.range*.2,ny=m.maxY-m.range*.05,arrowLen=Math.max(6,m.range*.16);
  line({x:nx,y:ny},{x:nx,y:ny+arrowLen},'NORTH');
  line({x:nx,y:ny+arrowLen},{x:nx-arrowLen*.24,y:ny+arrowLen*.6},'NORTH');
  line({x:nx,y:ny+arrowLen},{x:nx+arrowLen*.24,y:ny+arrowLen*.6},'NORTH');
  text('شمال',{x:nx-charSize*.3,y:ny+arrowLen+charSize*.5},charSize*1.5,'NORTH');
  text('CIVIL AI - مخطط تقريبي لحدود الأرض',{x:m.minX,y:m.minY-m.range*.22},charSize,'ANNOTATIONS');
  text('المساحة '+m.area.toFixed(3)+' م²  - المحيط '+m.perimeter.toFixed(3)+' م',{x:m.minX,y:m.minY-m.range*.30},charSize,'ANNOTATIONS');
  text('مرجع الإحداثيات P1 WGS84: '+m.origin.lat.toFixed(8)+' / '+m.origin.lng.toFixed(8),{x:m.minX,y:m.minY-m.range*.38},charSize*.8,'ANNOTATIONS');
  text('إحداثيات محلية بالمتر - اتجاه الشمال للأعلى - ليس رفعا مساحيا رسميا',{x:m.minX,y:m.minY-m.range*.45},charSize*.7,'ANNOTATIONS');
  write('0','ENDSEC','0','EOF');
  return lines.join('\n')+'\n';
 }
 function createPDF(data,geom){
  const m=normalize(data,geom);
  const ctor=typeof window!=='undefined'&&window.jspdf&&window.jspdf.jsPDF;
  if(!ctor)throw Error('تعذر تحميل مكتبة إنشاء PDF. تحقق من الاتصال بالإنترنت وأعد المحاولة.');
  if(typeof document==='undefined')throw Error('إنشاء PDF العربي يتطلب متصفحًا يدعم Canvas');
  const pdf=new ctor({orientation:'landscape',unit:'mm',format:'a4',compress:true});
  const pw=297,ph=210,box={x:14,y:36,w:210,h:152},side=232;
  pdf.setFillColor(252,254,255);pdf.rect(0,0,pw,ph,'F');
  pdf.setDrawColor(180,200,212);pdf.setLineWidth(.3);pdf.rect(box.x,box.y,box.w,box.h);
  const extentX=Math.max(m.maxX-m.minX,1),extentY=Math.max(m.maxY-m.minY,1);
  const scale=Math.min((box.w-19)/extentX,(box.h-21)/extentY);
  const originX=box.x+(box.w-extentX*scale)/2,originY=box.y+(box.h-extentY*scale)/2;
  const xy=p=>({x:originX+(p.x-m.minX)*scale,y:originY+(m.maxY-p.y)*scale});
  const ar=(label,x,y,size=5,color='#16394e',align='right')=>{
   const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
   if(!ctx)throw Error('المتصفح لا يدعم رسم النصوص العربية');
   const fontPx=44;
   ctx.font='bold '+fontPx+'px Tahoma, Arial, sans-serif';
   const measured=Math.ceil(ctx.measureText(String(label)).width);
   canvas.width=Math.max(28,Math.min(3000,measured+30));canvas.height=77;
   const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);
   c.font='bold '+fontPx+'px Tahoma, Arial, sans-serif';c.direction='rtl';c.textAlign='right';c.textBaseline='middle';c.fillStyle=color;
   c.fillText(String(label),canvas.width-12,39,canvas.width-24);
   const h=size*1.7,w=canvas.width/canvas.height*h;
   const posX=align==='center'?x-w/2:align==='left'?x:x-w;
   pdf.addImage(canvas.toDataURL('image/png'),'PNG',posX,y-h/2,w,h);
  };
  ar('مخطط مساحة أرض عبر الأقمار الصناعية',286,12,7.4);
  ar('Civil AI - رسم هندسي تقريبي حسب إحداثيات الخريطة',286,24,4.1,'#3d6d7b');
  pdf.setLineWidth(.52);pdf.setDrawColor(21,141,159);pdf.setFillColor(222,246,239);
  const a=xy(m.parcel[0]);const poly=m.parcel.slice(1).map(p=>xy(p));
  const polygonPath=[a,...poly].map((p,i,list)=>{const q=list[(i+1)%list.length];return [q.x-p.x,q.y-p.y]});
  pdf.lines(polygonPath,a.x,a.y,[1,1],'FD',true);
  m.parcel.forEach((p,i)=>{
   const v=xy(p),next=xy(m.parcel[(i+1)%m.parcel.length]);
   pdf.setFillColor(215,146,55);pdf.circle(v.x,v.y,1.15,'F');
   pdf.setTextColor(22,43,63);pdf.setFontSize(7);pdf.text('P'+(i+1),v.x+2.5,v.y-2.5);
   ar(m.edges[i].toFixed(2)+' م',(v.x+next.x)/2,(v.y+next.y)/2-3,3.2,'#205d6b','center');
  });
  m.roads.forEach(road=>{
   pdf.setLineWidth(road.source==='OpenStreetMap'?.75:1);
   if(road.source==='OpenStreetMap')pdf.setDrawColor(215,103,33);
   else pdf.setDrawColor(202,57,73);
   for(let i=0;i<road.xy.length-1;i++){
    const p=xy(road.xy[i]),q=xy(road.xy[i+1]);pdf.line(p.x,p.y,q.x,q.y);
   }
   const middle=xy(road.xy[Math.floor(road.xy.length/2)]);
   ar((road.name||'شارع '+road.index)+(road.width?' - عرض '+road.width+' م':''),middle.x,middle.y-3.5,3.4,'#a2372a','center');
  });
  pdf.setDrawColor(12,58,92);pdf.setLineWidth(.8);
  pdf.line(252,150,252,112);pdf.line(252,112,248,124);pdf.line(252,112,256,124);
  ar('شمال',262,105,5.2);
  ar('بيانات الأرض',289,43,5.4);
  ar('المساحة: '+m.area.toFixed(2)+' متر مربع',289,59,4.3);
  ar('المحيط: '+m.perimeter.toFixed(2)+' متر',289,72,4.3);
  ar('عدد الزوايا: '+m.parcel.length,289,85,4.3);
  ar('الشوارع المضافة: '+m.roads.length,289,98,4.3);
  ar('إحداثيات النقطة الأولى',289,162,4.3);
  pdf.setTextColor(30,54,78);pdf.setFontSize(8);
  pdf.text('Lat: '+m.origin.lat.toFixed(7),284,172,{align:'right'});
  pdf.text('Lon: '+m.origin.lng.toFixed(7),284,179,{align:'right'});
  ar('القياس تقريبي وليس رفعا مساحيا رسميا',286,196,3.6,'#92452d');
  ar('مصدر الطرق التلقائية: OpenStreetMap - لا تتضمن الملفات صور الأقمار الصناعية',286,204,3.1,'#506b7a');
  return pdf.output('blob');
 }
 return{createDXF,createPDF,project:normalize};
});