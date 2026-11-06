'use strict';
(function(){
const $=id=>document.getElementById(id);
const G=window.CivilLandGeometry;
if(!G){$('status').textContent='لم يتم تحميل محرك الحساب.';return}
const NS='http://www.w3.org/2000/svg';
let mode='coordinates',points=[{x:'0',y:'0'},{x:'35',y:'0'},{x:'44',y:'22'},{x:'20',y:'35'},{x:'0',y:'20'}],triangles=[{a:'15',b:'20',c:'25'}],latest=null,diagramTransform=null;
let drawTool='move',selected=-1,dragging=null,undoStack=[],showLengths=true,showAngles=true,snapGrid=false;
let referencePoint=0,targetPoint=1,pickingDistance=false,pickStep=0;
const distanceInfo=()=>{
 const a=points[referencePoint],b=points[targetPoint];
 if(!a||!b||referencePoint===targetPoint)return null;
 const ax=parse(a.x),ay=parse(a.y),bx=parse(b.x),by=parse(b.y);
 if(![ax,ay,bx,by].every(Number.isFinite))return null;
 const dx=bx-ax,dy=by-ay;
 return {metres:Math.hypot(dx,dy),bearing:(Math.atan2(dy,dx)*180/Math.PI+360)%360};
};
const refreshDistancePair=()=>{
 const from=$('distanceFrom'),to=$('distanceTo');
 for(const select of [from,to]){
  select.replaceChildren();
  points.forEach((p,i)=>{
   const option=document.createElement('option');option.value=String(i);option.textContent='P'+(i+1);
   select.append(option);
  });
 }
 if(referencePoint>=points.length)referencePoint=0;
 if(targetPoint>=points.length||targetPoint===referencePoint)targetPoint=points.length>1?(referencePoint+1)%points.length:-1;
 from.value=String(referencePoint);to.value=String(targetPoint);updateDistanceReadout();
};
const updateDistanceReadout=()=>{
 const details=distanceInfo();
 const active=mode==='coordinates'&&!!details;
 for(const id of ['distanceMeters','distanceBearing','distanceApply'])$(id).disabled=!active;
 if(!details){
  $('distanceReadout').textContent='اختر نقطتين مختلفتين لهما إحداثيات صحيحة.';
  $('distanceMeters').value='';$('distanceBearing').value='';return;
 }
 $('distanceReadout').textContent='المسافة بين P'+(referencePoint+1)+' وP'+(targetPoint+1)+': '+fmt(details.metres,3)+' متر · الاتجاه: '+fmt(details.bearing,2)+'°';
 if(document.activeElement!==$('distanceMeters'))$('distanceMeters').value=Number(details.metres.toFixed(4));
 if(document.activeElement!==$('distanceBearing'))$('distanceBearing').value=Number(details.bearing.toFixed(3));
};
const recordUndo=()=>{undoStack.push(points.map(p=>({...p})));if(undoStack.length>30)undoStack.shift()};
const measureAngle=(idx)=>{
 if(points.length<3||idx<0||idx>=points.length)return NaN;
 const n=points.length,p=points[idx],pre=points[(idx+n-1)%n],next=points[(idx+1)%n];
 const x=Number(p.x),y=Number(p.y),px=Number(pre.x),py=Number(pre.y),nx=Number(next.x),ny=Number(next.y);
 if(![x,y,px,py,nx,ny].every(Number.isFinite))return NaN;
 const signed=points.reduce((sum,a,i)=>{const b=points[(i+1)%n];return sum+Number(a.x)*Number(b.y)-Number(b.x)*Number(a.y)},0);
 const orientation=Math.sign(signed)||1;
 const inX=x-px,inY=y-py,outX=nx-x,outY=ny-y;
 const turn=Math.atan2(inX*outY-inY*outX,inX*outX+inY*outY)*180/Math.PI;
 return (180-orientation*turn+360)%360||360;
};
const syncEditor=()=>{
 const active=mode==='coordinates'&&selected>=0&&selected<points.length;
 $('selectedTitle').textContent=active?'الزاوية P'+(selected+1)+' — اختر الإحداثيات أو الزاوية':'اضغط على زاوية من الرسم لتعديلها';
 for(const id of ['selectedX','selectedY','selectedAngle'])$(id).disabled=!active;
 if(!active)return;
 $('selectedX').value=points[selected].x;
 $('selectedY').value=points[selected].y;
 const a=measureAngle(selected);$('selectedAngle').value=Number.isFinite(a)?Number(a.toFixed(2)):'';
};
const pointCoords=(e)=>{
 const rect=$('landDiagram').getBoundingClientRect();
 const sx=(e.clientX-rect.left)*480/rect.width,sy=(e.clientY-rect.top)*330/rect.height;
 return {sx,sy};
};
const worldCoords=(sx,sy)=>{
 const t=diagramTransform||{scale:5,centerX:0,centerY:0};
 const x=t.centerX+(sx-240)/t.scale,y=t.centerY-(sy-165)/t.scale;
 return {x:snapGrid?Math.round(x):Number(x.toFixed(3)),y:snapGrid?Math.round(y):Number(y.toFixed(3))};
};

const fmt=(v,dec=4)=>Number.isFinite(v)?new Intl.NumberFormat('en-US',{maximumFractionDigits:dec}).format(v):'—';
const el=(tag,attrs={},content)=>{const a=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))a.setAttribute(k,String(v));if(content!==undefined)a.textContent=String(content);return a};
function showStatus(message,error=false){const s=$('status');s.classList.toggle('error',!!error);s.textContent=message}
function parse(s){if(String(s).trim()==='')return NaN;return Number(s)}
function addTableRow(body,i,values,kind){
 const tr=document.createElement('tr'),th=document.createElement('th');th.scope='row';th.textContent=kind==='point'?'P'+(i+1):'△ '+(i+1);tr.append(th);
 for(const key of values){
  const td=document.createElement('td'),input=document.createElement('input');
  input.type='number';input.inputMode='decimal';input.step='any';input.value=String((kind==='point'?points[i]:triangles[i])[key]??'');input.setAttribute('aria-label',(kind==='point'?'زاوية ':'مثلث ')+(i+1)+' '+key);
  input.oninput=()=>{(kind==='point'?points[i]:triangles[i])[key]=input.value;update()};
  td.append(input);tr.append(td);
 }
 const td=document.createElement('td'),btn=document.createElement('button');btn.type='button';btn.textContent='×';btn.title='حذف';btn.setAttribute('aria-label','حذف صف '+(i+1));
 btn.onclick=()=>{if(kind==='point')recordUndo();const target=kind==='point'?points:triangles;target.splice(i,1);if(kind==='point'&&selected>=target.length)selected=-1;renderInputs();update()};
 td.append(btn);tr.append(td);body.append(tr);
}
function renderInputs(){
 const p=$('pointRows'),t=$('triangleRows');p.replaceChildren();t.replaceChildren();
 points.forEach((_,i)=>addTableRow(p,i,['x','y'],'point'));
 triangles.forEach((_,i)=>addTableRow(t,i,['a','b','c'],'triangle'));
 refreshDistancePair();
}
function updateNumbers(area,perimeter,n){
 $('areaMain').textContent=area===null?'—':fmt(area,6)+' م²';
 $('areaM2').textContent=area===null?'—':fmt(area,6);
 $('areaLabna').textContent=area===null?'—':fmt(area/44.44,7);
 $('areaHa').textContent=area===null?'—':fmt(area/10000,7);
 $('areaAcre').textContent=area===null?'—':fmt(area/4046.8564224,7);
 $('perimeter').textContent=perimeter===null?'—':fmt(perimeter,5);
 $('pointCount').textContent=n;
 $('metricLabel').textContent=mode==='coordinates'?'محيط الأرض بالمتر':'مجموع أطوال أضلاع المثلثات (م)';
 $('countLabel').textContent=mode==='coordinates'?'عدد الزوايا':'عدد المثلثات';
}
function drawGrid(svg){
 for(let x=0;x<=480;x+=30)svg.append(el('line',{x1:x,y1:0,x2:x,y2:330,stroke:'#1d364c','stroke-width':.7}));
 for(let y=0;y<=330;y+=30)svg.append(el('line',{x1:0,y1:y,x2:480,y2:y,stroke:'#1d364c','stroke-width':.7}));
}
function drawPolygon(result){
 const svg=$('landDiagram');svg.replaceChildren();drawGrid(svg);
 if(!points.length){diagramTransform={scale:5,centerX:0,centerY:0};return;}
 const valid=points.map(p=>({x:parse(p.x),y:parse(p.y)})).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
 if(valid.length===0)return;
 const xs=valid.map(p=>p.x),ys=valid.map(p=>p.y);
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const width=Math.max(maxX-minX,10),height=Math.max(maxY-minY,10);
 const fit=Math.min(396/width,238/height,20);
 const scale=dragging?.transform?.scale||fit;
 const centerX=dragging?.transform?.centerX??(minX+maxX)/2;
 const centerY=dragging?.transform?.centerY??(minY+maxY)/2;
 const trans=p=>({x:240+(p.x-centerX)*scale,y:165-(p.y-centerY)*scale});
 diagramTransform={scale,centerX,centerY};
 const screen=valid.map(trans);
 if(screen.length>1){
  const d=screen.map((p,i)=>(i===0?'M':'L')+p.x.toFixed(3)+','+p.y.toFixed(3)).join(' ')+(result?.valid?' Z':'');
  svg.append(el('path',{d,fill:result?.valid?'rgba(223,179,70,0.15)':'none',stroke:'#e7b957','stroke-width':2.7,'stroke-linejoin':'round'}));
 }
 if(result?.valid&&result.triangles?.length){
  for(const ids of result.triangles){
   const a=screen[ids[0]],b=screen[ids[1]],c=screen[ids[2]];
   if(!a||!b||!c)continue;
   const centroid={x:(a.x+b.x+c.x)/3,y:(a.y+b.y+c.y)/3};
   svg.append(el('polygon',{points:[a,b,c].map(v=>v.x+','+v.y).join(' '),fill:'none',stroke:'#59d6dd','stroke-width':1.1,'stroke-dasharray':'4 3'}));
   svg.append(el('text',{x:centroid.x,y:centroid.y,fill:'#9eecf3','font-size':10,'text-anchor':'middle','paint-order':'stroke',stroke:'#081929','stroke-width':3},'△'));
  }
 }
 if(result?.valid&&showLengths&&screen.length>1){
   screen.forEach((p,i)=>{
     const q=screen[(i+1)%screen.length],a=valid[i],b=valid[(i+1)%valid.length];
     const distance=Math.hypot(b.x-a.x,b.y-a.y);
     const tx=(p.x+q.x)/2,ty=(p.y+q.y)/2;
     svg.append(el('text',{x:tx,y:ty-7,'text-anchor':'middle','font-size':10,fill:'#ffc870','paint-order':'stroke',stroke:'#081929','stroke-width':3},fmt(distance,2)+' m'));
   });
 }
 if(referencePoint!==targetPoint&&screen[referencePoint]&&screen[targetPoint]){
   const a=screen[referencePoint],b=screen[targetPoint];
   svg.append(el('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,class:'distance-line'}));
   const details=distanceInfo();
   if(details)svg.append(el('text',{x:(a.x+b.x)/2,y:(a.y+b.y)/2-13,'text-anchor':'middle',class:'distance-label'},fmt(details.metres,2)+' m'));
 }
 screen.forEach((p,i)=>{
   if(result?.valid&&showAngles){
     const angle=measureAngle(i);
     if(Number.isFinite(angle))svg.append(el('text',{x:p.x+10,y:p.y+17,'font-size':10,fill:'#78e8c7','paint-order':'stroke',stroke:'#081929','stroke-width':3},fmt(angle,1)+'°'));
   }
   svg.append(el('circle',{cx:p.x,cy:p.y,r:selected===i?8:5.5,fill:i===referencePoint?'#8bedff':i===targetPoint?'#faacd9':selected===i?'#ff9654':'#ffdd83',stroke:'#162838','stroke-width':1.7}));
   svg.append(el('circle',{cx:p.x,cy:p.y,r:17,class:'vertex-hit','data-index':i,'aria-label':'تحريك الزاوية P'+(i+1)}));
   svg.append(el('text',{x:p.x+9,y:p.y-9,'font-size':12,fill:'#f7f5e8','paint-order':'stroke',stroke:'#061827','stroke-width':3},'P'+(i+1)));
 });
 svg.append(el('text',{x:16,y:317,'font-size':11,fill:'#9ebed0'},'رسم تخطيطي متناسب · أدخل الإحداثيات الحقيقية للدقة'));
}
function drawTriangles(resultRows){
 const svg=$('landDiagram');svg.replaceChildren();drawGrid(svg);diagramTransform=null;
 if(!resultRows.length)return;
 const shown=resultRows.slice(0,8);
 shown.forEach((row,k)=>{
  const col=k%2,r=Math.floor(k/2),X=col*240,Y=r*82;
  const p1={x:X+27,y:Y+69},p2={x:X+205,y:Y+69},p3={x:X+119,y:Y+12};
  const valid=row.valid;
  svg.append(el('polygon',{points:[p1,p2,p3].map(v=>v.x+','+v.y).join(' '),fill:valid?'rgba(218,172,72,.14)':'none',stroke:valid?'#e7b957':'#a95b65','stroke-width':2}));
  svg.append(el('text',{x:X+116,y:Y+56,'font-size':13,fill:'#f4e8c5','text-anchor':'middle'},'△'+(k+1)+(valid?' · '+fmt(row.area,2)+' م²':' · خطأ')));
 });
 if(resultRows.length>8)svg.append(el('text',{x:240,y:319,'font-size':11,fill:'#b6d3df','text-anchor':'middle'},'عرض أول 8 مثلثات فقط'));
}
function update(){
 latest=null;
 if(mode==='coordinates'){
  if(selected>=points.length)selected=-1;
  const parsed=points.map(p=>({x:parse(p.x),y:parse(p.y)}));
  let result;
  if(parsed.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))
    result={valid:false,error:'coordinates'};
  else result=G.polygonArea(parsed);
  drawPolygon(result);
  if(!dragging)syncEditor();
  updateDistanceReadout();
  if(!result.valid){
   const errors={vertices:'أدخل ثلاث زوايا على الأقل.',coordinates:'أكمل الإحداثيات الرقمية الصحيحة لكل زاوية.',limit:'الحد الأقصى 100 زاوية.',duplicate:'هناك زاويتان متجاورتان متطابقتان أو ضلع طوله صفر.',crossing:'حدود الأرض تتقاطع أو تلامس نفسها. راجع ترتيب الزوايا.',zero:'المضلع ليس له مساحة أفقية قابلة للحساب.'};
   showStatus(errors[result.error]||'تعذر حساب المساحة. راجع الإحداثيات.',true);
   updateNumbers(null,null,points.length);return;
  }
  latest={mode,area:result.area,perimeter:result.perimeter,points:parsed,triangles:result.triangles};
  updateNumbers(result.area,result.perimeter,points.length);
  const triangulated=result.triangles.length?' · تم تقسيم الرسم إلى '+result.triangles.length+' مثلثات توضيحية.':'';
  showStatus('مساحة محسوبة من إحداثيات '+points.length+' زوايا بالمتر، مع التحقق من عدم تقاطع الحدود.'+triangulated);
 }else{
  const rows=triangles.map(row=>G.triangleSides(parse(row.a),parse(row.b),parse(row.c)));
  drawTriangles(rows);
  const bad=rows.findIndex(r=>!r.valid);
  if(!rows.length||bad!==-1){
   const fail=bad!==-1?rows[bad].error:'missing';
   showStatus(!rows.length?'أضف مثلثًا واحدًا على الأقل.':fail==='inequality'?'المثلث رقم '+(bad+1)+' غير ممكن: مجموع أي ضلعين يجب أن يزيد عن الثالث.':'راجع أضلاع المثلث رقم '+(bad+1)+' (ثلاثة أطوال موجبة بالمتر).',true);
   updateNumbers(null,null,triangles.length);return;
  }
  const area=rows.reduce((sum,r)=>sum+r.area,0),perimeter=rows.reduce((sum,r)=>sum+r.perimeter,0);
  if(!Number.isFinite(area))return showStatus('نتيجة خارج المدى العددي. راجع الأطوال.',true);
  latest={mode,area,perimeter,triangles:triangles.map(t=>({a:parse(t.a),b:parse(t.b),c:parse(t.c)})),triangleAreas:rows.map(r=>r.area)};
  updateNumbers(area,perimeter,triangles.length);
  showStatus('مجموع مساحات '+triangles.length+' مثلثات بطريقة هيرون. تحقّق بنفسك من أن تقسيم الأرض بلا تداخل أو فراغات.');
 }
}
function setMode(next){
 mode=next;
 $('coordinateMode').hidden=next!=='coordinates';$('triangleMode').hidden=next!=='triangles';
 $('modeCoordinates').setAttribute('aria-pressed',String(next==='coordinates'));
 $('modeTriangles').setAttribute('aria-pressed',String(next==='triangles'));
 $('drawingTools').hidden=next!=='coordinates';$('selectedEditor').hidden=next!=='coordinates';$('distanceEditor').hidden=next!=='coordinates';
 $('sketchHelp').textContent=next==='coordinates'?'حدود الأرض بالذهبي والمثلثات التوضيحية بالأزرق. يمكنك إضافة زاوية بالنقر على الرسم.':'المثلثات المرسومة توضيحية وليست بمقياس أضلاع حقيقي؛ أدخل الأطوال المقاسة في الجدول.';
 update();
}
$('modeCoordinates').onclick=()=>setMode('coordinates');
$('modeTriangles').onclick=()=>setMode('triangles');
$('addPoint').onclick=()=>{
 if(points.length>=100)return showStatus('الحد الأقصى 100 زاوية.',true);
 recordUndo();const n=points.length;
 points.push(n?{x:String((parse(points[n-1].x)||0)+10),y:String(parse(points[n-1].y)||0)}:{x:'0',y:'0'});
 renderInputs();update();
};
$('loadExample').onclick=()=>{recordUndo();points=[{x:'0',y:'0'},{x:'35',y:'0'},{x:'44',y:'22'},{x:'20',y:'35'},{x:'0',y:'20'}];renderInputs();update()};
$('clearPoints').onclick=()=>{if(!confirm('هل تريد مسح جميع الزوايا؟'))return;recordUndo();points=[];selected=-1;renderInputs();update()};
$('addTriangle').onclick=()=>{if(triangles.length>=100)return showStatus('الحد الأقصى 100 مثلث.',true);triangles.push({a:'15',b:'20',c:'25'});renderInputs();update()};
$('exampleTriangles').onclick=()=>{triangles=[{a:'3',b:'4',c:'5'},{a:'5',b:'5',c:'6'}];renderInputs();update()};
$('clearTriangles').onclick=()=>{if(!confirm('هل تريد مسح المثلثات؟'))return;triangles=[];renderInputs();update()};

const changeTool=(tool)=>{
 drawTool=tool;
 $('drawAdd').setAttribute('aria-pressed',String(tool==='add'));
 $('drawMove').setAttribute('aria-pressed',String(tool==='move'));
 $('landDiagram').classList.toggle('editing',tool==='add');
};
$('drawAdd').onclick=()=>changeTool('add');
$('drawMove').onclick=()=>changeTool('move');
$('drawClose').onclick=()=>{changeTool('move');showStatus('تم إغلاق وضع إضافة النقاط. يُغلق المضلع تلقائيًا إذا كان صالحًا.')};
$('drawUndo').onclick=()=>{
 if(!undoStack.length)return showStatus('لا توجد حركة سابقة للتراجع.');
 points=undoStack.pop();selected=-1;renderInputs();update();
};
$('showLengths').onchange=e=>{showLengths=e.target.checked;update()};
$('showAngles').onchange=e=>{showAngles=e.target.checked;update()};
$('snapGrid').onchange=e=>{snapGrid=e.target.checked};
$('selectedX').onchange=$('selectedY').onchange=e=>{
 if(selected<0||selected>=points.length)return;
 const key=e.target.id==='selectedX'?'x':'y';
 const val=parse(e.target.value);
 if(!Number.isFinite(val))return showStatus('إحداثيات غير صالحة.',true);
 recordUndo();points[selected][key]=String(val);renderInputs();update();
};
$('selectedAngle').onchange=e=>{
 if(selected<0||points.length<3)return;
 const desired=parse(e.target.value),before=measureAngle(selected),n=points.length;
 if(!(desired>0&&desired<360)&&desired!==360)return showStatus('اختر زاوية داخلية أكبر من صفر وأقل من 360 درجة.',true);
 if(!Number.isFinite(before))return showStatus('لا يمكن تحديد زاوية من هذه النقاط.',true);
 const p=points[selected],next=points[(selected+1)%n];
 const px=parse(p.x),py=parse(p.y),nx=parse(next.x),ny=parse(next.y);
 const len=Math.hypot(nx-px,ny-py);
 if(!(len>0))return;
 const orientation=Math.sign(points.reduce((sum,a,i)=>{const b=points[(i+1)%n];return sum+parse(a.x)*parse(b.y)-parse(b.x)*parse(a.y)},0))||1;
 const prev=points[(selected+n-1)%n];
 const backDir=Math.atan2(parse(prev.y)-py,parse(prev.x)-px);
 const nextDir=backDir-orientation*desired*Math.PI/180;
 const candidate={x:String(Number((px+len*Math.cos(nextDir)).toFixed(4))),y:String(Number((py+len*Math.sin(nextDir)).toFixed(4)))};
 const candidatePoints=points.map(o=>({x:parse(o.x),y:parse(o.y)}));
 candidatePoints[(selected+1)%n]={x:Number(candidate.x),y:Number(candidate.y)};
 const result=G.polygonArea(candidatePoints);
 if(!result.valid)return showStatus('هذه الزاوية تنتج حدودًا غير صالحة؛ لم تُطبّق. عدّل الإحداثيات أو اختر زاوية أخرى.',true);
 recordUndo();Object.assign(next,candidate);renderInputs();update();
};

$('distanceFrom').onchange=e=>{
 referencePoint=Number(e.target.value);
 if(referencePoint===targetPoint&&points.length>1)targetPoint=(referencePoint+1)%points.length;
 refreshDistancePair();update();
};
$('distanceTo').onchange=e=>{
 targetPoint=Number(e.target.value);
 if(targetPoint===referencePoint&&points.length>1)referencePoint=(targetPoint+1)%points.length;
 refreshDistancePair();update();
};
$('distancePick').onclick=()=>{
 pickingDistance=!pickingDistance;pickStep=0;
 $('distancePick').setAttribute('aria-pressed',String(pickingDistance));
 $('distancePick').textContent=pickingDistance?'اضغط النقطة الأولى':'اختيار نقطتين من الرسم';
 if(pickingDistance)changeTool('move');
 showStatus(pickingDistance?'اضغط على النقطة المرجعية أولًا، ثم النقطة الثانية.':'أُلغي وضع اختيار النقاط.');
};
$('distanceApply').onclick=()=>{
 if(referencePoint===targetPoint||!points[referencePoint]||!points[targetPoint])return showStatus('اختر نقطتين مختلفتين أولًا.',true);
 const distance=parse($('distanceMeters').value),angle=parse($('distanceBearing').value);
 if(!Number.isFinite(distance)||distance<=0||distance>1e10||!Number.isFinite(angle)||Math.abs(angle)>1e9)return showStatus('المسافة يجب أن تكون رقمًا موجبًا بالمتر والاتجاه رقمًا بالدرجات.',true);
 const origin=points[referencePoint],ax=parse(origin.x),ay=parse(origin.y);
 if(![ax,ay].every(Number.isFinite))return showStatus('الإحداثيات المرجعية غير صحيحة.',true);
 const rad=angle*Math.PI/180;
 const next={x:Number((ax+distance*Math.cos(rad)).toFixed(6)),y:Number((ay+distance*Math.sin(rad)).toFixed(6))};
 if(!Number.isFinite(next.x)||!Number.isFinite(next.y))return showStatus('الإحداثيات الناتجة خارج المدى.',true);
 const candidate=points.map(p=>({x:parse(p.x),y:parse(p.y)}));
 candidate[targetPoint]=next;
 const result=G.polygonArea(candidate);
 if(!result.valid)return showStatus('المسافة والاتجاه الجديدان يجعلان حدود الأرض غير صالحة أو متقاطعة، لم يُطبّق التغيير.',true);
 recordUndo();points[targetPoint]={x:String(next.x),y:String(next.y)};
 selected=targetPoint;renderInputs();update();
 showStatus('تم تحريك P'+(targetPoint+1)+' من P'+(referencePoint+1)+' بمسافة '+fmt(distance,3)+' متر واتجاه '+fmt((angle%360+360)%360,2)+'°.');
};
const plot=$('landDiagram');
plot.addEventListener('pointerdown',e=>{
 if(mode!=='coordinates'||e.button>0||!diagramTransform)return;
 const {sx,sy}=pointCoords(e);
 const target=e.target.closest?.('[data-index]');
 if(target){
   selected=Number(target.dataset.index);
   if(selected<0||selected>=points.length)return;
   if(pickingDistance){
    if(pickStep===0){referencePoint=selected;pickStep=1;showStatus('اختر النقطة الثانية الآن؛ ستتحرك بالنسبة للأولى.')}
    else{
     if(selected===referencePoint)return showStatus('اختر نقطة ثانية مختلفة.',true);
     targetPoint=selected;pickingDistance=false;pickStep=0;
     $('distancePick').setAttribute('aria-pressed','false');
     $('distancePick').textContent='اختيار نقطتين من الرسم';
     showStatus('تم اختيار P'+(referencePoint+1)+' وP'+(targetPoint+1)+'. يمكنك تعديل المسافة والاتجاه.');
    }
    refreshDistancePair();update();e.preventDefault();return;
   }
   if(drawTool!=='move'){changeTool('move');}
   recordUndo();
   dragging={pointerId:e.pointerId,index:selected,transform:{...diagramTransform}};
   plot.setPointerCapture?.(e.pointerId);
   plot.classList.add('editing');
   e.preventDefault();syncEditor();update();return;
 }
 if(drawTool==='add'){
  if(points.length>=100)return showStatus('الحد الأقصى 100 زاوية.',true);
  if(sx<5||sx>475||sy<5||sy>325)return;
  const p=worldCoords(sx,sy);
  recordUndo();points.push({x:String(p.x),y:String(p.y)});selected=points.length-1;
  renderInputs();update();e.preventDefault();
 }
});
plot.addEventListener('pointermove',e=>{
 if(!dragging||dragging.pointerId!==e.pointerId||mode!=='coordinates')return;
 const {sx,sy}=pointCoords(e),p=worldCoords(sx,sy);
 if(!Number.isFinite(p.x)||!Number.isFinite(p.y))return;
 points[dragging.index]={x:String(p.x),y:String(p.y)};
 update();
 e.preventDefault();
});
const finishDrag=e=>{
 if(!dragging||dragging.pointerId!==e.pointerId)return;
 const previous=dragging;
 dragging=null;
 try{if(plot.hasPointerCapture?.(e.pointerId))plot.releasePointerCapture(e.pointerId)}catch{}
 if(drawTool!=='add')plot.classList.remove('editing');
 const result=G.polygonArea(points.map(p=>({x:parse(p.x),y:parse(p.y)})));
 if(!result.valid){
   points=undoStack.pop()||points;
   showStatus('السحب أدى إلى شكل متقاطع أو غير صالح؛ أُعيدت النقطة لموقعها السابق.',true);
 }
 renderInputs();update();
 e.preventDefault();
};
plot.addEventListener('pointerup',finishDrag);
plot.addEventListener('pointercancel',finishDrag);
$('copyArea').onclick=async()=>{
 if(!latest)return showStatus('صحّح البيانات قبل نسخ النتيجة.',true);
 try{await navigator.clipboard.writeText(($('projectTitle').value||'مساحة أرض')+': '+fmt(latest.area,6)+' م²');showStatus('تم نسخ نتيجة المساحة.')}
 catch{showStatus('تعذر النسخ. يمكنك نسخ المساحة يدويًا.',true)}
};
$('printArea').onclick=()=>window.print();
$('saveProject').onclick=async()=>{
 if(!latest)return showStatus('لا يمكن حفظ مشروع قبل تصحيح البيانات.',true);
 const btn=$('saveProject');btn.disabled=true;
 try{
  const data={...latest,type:'irregular-land',title:($('projectTitle').value||'مساحة أرض غير منتظمة').trim().slice(0,120),createdAt:new Date().toISOString(),units:'metres',warning:'يجب التحقق المساحي من إحداثيات الحدود أو تقسيم المثلثات قبل الاستخدام الرسمي.'};
  const response=await fetch('/api/projects?action=create',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:data.title,type:'irregular-land',data})});
  const r=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(r.error||'HTTP '+response.status);
  showStatus('تم حفظ المشروع ومساحته باسم حسابك في «مشاريعي».');
 }catch(e){showStatus('تعذر حفظ المشروع: '+e.message,true)}finally{btn.disabled=false}
};
renderInputs();setMode('coordinates');
})();