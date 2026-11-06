'use strict';
/* Civil AI: editable AutoCAD DXF R12 and vector A4 landscape PDF for user-drawn satellite site plans.
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
  return (Array.isArray(roads)?roads:[]).slice(0,50).map((r,i)=>({
   name:typeof r.name==='string'?r.name.slice(0,80):'Road '+(i+1),
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
  const layers=[['PARCEL',2],['ROAD_CENTER',4],['CORNERS',1],['DIMENSIONS',3],['NORTH',5],['ANNOTATIONS',7]];
  write('0','SECTION','2','HEADER','9','$ACADVER','1','AC1009','9','$INSUNITS','70','6','0','ENDSEC',
    '0','SECTION','2','TABLES','0','TABLE','2','LAYER','70',String(layers.length));
  layers.forEach(([name,col])=>write('0','LAYER','2',name,'70','0','62',String(col),'6','CONTINUOUS'));
  write('0','ENDTAB','0','ENDSEC','0','SECTION','2','ENTITIES');
  const coord=p=>['10',round(p.x),'20',round(p.y),'30','0'];
  const polyline=(pts,layer,closed)=>{
   write('0','POLYLINE','8',layer,'66','1','70',closed?'1':'0','10','0','20','0','30','0');
   pts.forEach(p=>write('0','VERTEX','8',layer,...coord(p)));
   write('0','SEQEND','8',layer);
  };
  const line=(a,b,layer)=>write('0','LINE','8',layer,...coord(a),'11',round(b.x),'21',round(b.y),'31','0');
  const text=(value,p,size,layer,angle=0)=>{
   write('0','TEXT','8',layer,...coord(p),'40',round(size),'1',String(value).replace(/[^\x20-\x7e]/g,'').slice(0,190),'50',round(angle));
  };
  polyline(m.parcel,'PARCEL',true);
  const charSize=Math.max(.6,Math.min(3,m.range*.025));
  m.parcel.forEach((p,i)=>{
   const q=m.parcel[(i+1)%m.parcel.length];
   write('0','POINT','8','CORNERS',...coord(p));
   text('P'+(i+1),{x:p.x+charSize*.35,y:p.y+charSize*.35},charSize,'CORNERS');
   text(m.edges[i].toFixed(2)+' m',{x:(p.x+q.x)/2,y:(p.y+q.y)/2+charSize*.45},charSize*.75,'DIMENSIONS');
  });
  m.roads.forEach(road=>{
   polyline(road.xy,'ROAD_CENTER',false);
   const center=road.xy[Math.floor(road.xy.length/2)];
   const asciiName=/[\x20-\x7e]/.test(road.name)?road.name.replace(/[^\x20-\x7e]/g,'').trim():'ROAD '+road.index;
   text((asciiName||'ROAD '+road.index)+(road.width?' W='+road.width+'m':''),{x:center.x+charSize,y:center.y+charSize},charSize*.85,'ANNOTATIONS');
  });
  const nx=m.maxX+m.range*.2,ny=m.maxY-m.range*.05,arrowLen=Math.max(6,m.range*.16);
  line({x:nx,y:ny},{x:nx,y:ny+arrowLen},'NORTH');
  line({x:nx,y:ny+arrowLen},{x:nx-arrowLen*.24,y:ny+arrowLen*.6},'NORTH');
  line({x:nx,y:ny+arrowLen},{x:nx+arrowLen*.24,y:ny+arrowLen*.6},'NORTH');
  text('N',{x:nx-charSize*.3,y:ny+arrowLen+charSize*.5},charSize*1.5,'NORTH');
  text('CIVIL AI - APPROXIMATE SITE PLAN',{x:m.minX,y:m.minY-m.range*.22},charSize,'ANNOTATIONS');
  text('AREA '+m.area.toFixed(3)+' SQ.M  PERIM '+m.perimeter.toFixed(3)+' M',{x:m.minX,y:m.minY-m.range*.30},charSize,'ANNOTATIONS');
  text('P1 ORIGIN WGS84 LAT '+m.origin.lat.toFixed(8)+' LON '+m.origin.lng.toFixed(8),{x:m.minX,y:m.minY-m.range*.38},charSize*.8,'ANNOTATIONS');
  text('LOCAL METRE COORDINATES - NORTH UP - NOT A LEGAL SURVEY',{x:m.minX,y:m.minY-m.range*.45},charSize*.7,'ANNOTATIONS');
  write('0','ENDSEC','0','EOF');
  return lines.join('\n')+'\n';
 }
 function createPDF(data,geom){
  const m=normalize(data,geom),cmd=[];
  const w=842,h=595,box={x:42,y:82,w:575,h:428},right=654;
  const width=Math.max(m.maxX-m.minX,1),height=Math.max(m.maxY-m.minY,1);
  const scale=Math.min(box.w/width,box.h/height);
  const sx=box.x+(box.w-width*scale)/2,sy=box.y+(box.h-height*scale)/2;
  const xy=p=>({x:sx+(p.x-m.minX)*scale,y:sy+(p.y-m.minY)*scale});
  const num=n=>Number(n.toFixed(3));
  const path=(pts,closed,stroke,fill='')=>{
   if(!pts.length)return;
   cmd.push(stroke,'1.65 w');
   const a=xy(pts[0]);cmd.push(num(a.x)+' '+num(a.y)+' m');
   for(let i=1;i<pts.length;i++){const p=xy(pts[i]);cmd.push(num(p.x)+' '+num(p.y)+' l')}
   if(closed)cmd.push('h');
   cmd.push(fill||'S');
  };
  const txt=(s,x,y,size=10)=>cmd.push('BT /F1 '+num(size)+' Tf 1 0 0 1 '+num(x)+' '+num(y)+' Tm ('+escPdf(s)+') Tj ET');
  const line=(x1,y1,x2,y2)=>cmd.push(num(x1)+' '+num(y1)+' m '+num(x2)+' '+num(y2)+' l S');
  cmd.push('1 1 1 rg 0 0 '+w+' '+h+' re f','0.10 0.22 0.32 RG');
  txt('CIVIL AI  |  SATELLITE-BASED SITE PLAN',40,553,17);
  txt('Vector survey drawing  -  A4 landscape  -  North up',40,535,10);
  cmd.push('.82 .88 .90 RG 0.7 w');
  cmd.push('34 68 600 452 re S');
  cmd.push('.1 .6 .46 rg .15 .55 .45 RG');
  const parcelPoints=m.parcel;
  const pa=xy(parcelPoints[0]);cmd.push(num(pa.x)+' '+num(pa.y)+' m');
  parcelPoints.slice(1).forEach(v=>{const p=xy(v);cmd.push(num(p.x)+' '+num(p.y)+' l')});
  cmd.push('h B');
  cmd.push('0.03 0.23 0.45 RG 0 0 0 rg 1.2 w');
  m.parcel.forEach((p,i)=>{
   const a=xy(p),b=xy(m.parcel[(i+1)%m.parcel.length]);
   cmd.push(num(a.x-2.4)+' '+num(a.y-2.4)+' 4.8 4.8 re f');
   txt('P'+(i+1),a.x+5,a.y+5,8);
   txt(m.edges[i].toFixed(2)+' m',(a.x+b.x)/2+2,(a.y+b.y)/2+5,8);
  });
  m.roads.forEach(road=>{
   cmd.push('0.79 0.22 0.13 RG 2.3 w');
   const ar=road.xy.map(xy);
   cmd.push(num(ar[0].x)+' '+num(ar[0].y)+' m');
   ar.slice(1).forEach(p=>cmd.push(num(p.x)+' '+num(p.y)+' l'));
   cmd.push('S','0 0 0 rg');
   const mid=ar[Math.floor(ar.length/2)];
   const asciiName=road.name.replace(/[^\x20-\x7e]/g,'').trim()||'ROAD '+road.index;
   txt(asciiName+(road.width?' ('+road.width+' m wide)':''),mid.x+5,mid.y+8,9);
  });
  cmd.push('0 0 0 rg 0 0 0 RG');
  txt('PARCEL SUMMARY',right,490,12);
  txt('Area: '+m.area.toFixed(3)+' sq.m',right,465,10);
  txt('Perimeter: '+m.perimeter.toFixed(3)+' m',right,447,10);
  txt('Corners: '+m.parcel.length,right,429,10);
  txt('Roads: '+m.roads.length,right,411,10);
  txt('WGS84 reference P1:',right,380,9);
  txt('Lat '+m.origin.lat.toFixed(8),right,365,9);
  txt('Lon '+m.origin.lng.toFixed(8),right,350,9);
  txt('N',750,288,17);
  cmd.push('0.05 0.2 0.4 RG 2 w');
  line(755,210,755,271);line(755,271,743,248);line(755,271,767,248);
  cmd.push('0 0 0 rg');
  txt('North arrow',707,194,9);
  txt('Legend:',right,157,9);
  txt('Blue/green = parcel',right,143,9);
  txt('Red = road centerline',right,129,9);
  txt('P1 = local XY origin',right,115,9);
  txt('Approximate satellite/map measurement. NOT an official cadastral survey.',40,45,9);
  txt('CAD uses local metre projection. Third-party satellite imagery is not redistributed.',40,30,8);
  const stream=cmd.join('\n')+'\n';
  // ASCII-only PDF 1.4: all byte offsets match JavaScript string offsets.
  const objects=[
   '<< /Type /Catalog /Pages 2 0 R >>',
   '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
   '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
   '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
   '<< /Length '+stream.length+' >>\nstream\n'+stream+'endstream'
  ];
  let pdf='%PDF-1.4\n',offsets=[0];
  for(let i=0;i<objects.length;i++){
   offsets.push(pdf.length);
   pdf+=(i+1)+' 0 obj\n'+objects[i]+'\nendobj\n';
  }
  const xref=pdf.length;
  pdf+='xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n';
  for(let i=1;i<offsets.length;i++)pdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
  pdf+='trailer\n<< /Size '+(objects.length+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';
  return pdf;
 }
 return{createDXF,createPDF,project:normalize};
});