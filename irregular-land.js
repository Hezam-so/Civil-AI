'use strict';
(function(){
const $=id=>document.getElementById(id);
const G=window.CivilLandGeometry;
if(!G){$('status').textContent='لم يتم تحميل محرك الحساب.';return}
const NS='http://www.w3.org/2000/svg';
let mode='coordinates',points=[{x:'0',y:'0'},{x:'35',y:'0'},{x:'44',y:'22'},{x:'20',y:'35'},{x:'0',y:'20'}],triangles=[{a:'15',b:'20',c:'25'}],latest=null,diagramTransform=null;
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
 btn.onclick=()=>{const target=kind==='point'?points:triangles;target.splice(i,1);renderInputs();update()};
 td.append(btn);tr.append(td);body.append(tr);
}
function renderInputs(){
 const p=$('pointRows'),t=$('triangleRows');p.replaceChildren();t.replaceChildren();
 points.forEach((_,i)=>addTableRow(p,i,['x','y'],'point'));
 triangles.forEach((_,i)=>addTableRow(t,i,['a','b','c'],'triangle'));
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
 if(!points.length)return;
 const valid=points.map(p=>({x:parse(p.x),y:parse(p.y)})).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
 if(valid.length===0)return;
 const xs=valid.map(p=>p.x),ys=valid.map(p=>p.y);
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const width=Math.max(maxX-minX,10),height=Math.max(maxY-minY,10),scale=Math.min(396/width,238/height,20);
 const centerX=(minX+maxX)/2,centerY=(minY+maxY)/2;
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
 screen.forEach((p,i)=>{
  svg.append(el('circle',{cx:p.x,cy:p.y,r:4.6,fill:'#ffdd83',stroke:'#162838','stroke-width':1.7}));
  svg.append(el('text',{x:p.x+7,y:p.y-8,'font-size':12,fill:'#f7f5e8','paint-order':'stroke',stroke:'#061827','stroke-width':3},'P'+(i+1)));
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
  const parsed=points.map(p=>({x:parse(p.x),y:parse(p.y)}));
  let result;
  if(parsed.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))
    result={valid:false,error:'coordinates'};
  else result=G.polygonArea(parsed);
  drawPolygon(result);
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
 $('sketchHelp').textContent=next==='coordinates'?'حدود الأرض بالذهبي والمثلثات التوضيحية بالأزرق. يمكنك إضافة زاوية بالنقر على الرسم.':'المثلثات المرسومة توضيحية وليست بمقياس أضلاع حقيقي؛ أدخل الأطوال المقاسة في الجدول.';
 update();
}
$('modeCoordinates').onclick=()=>setMode('coordinates');
$('modeTriangles').onclick=()=>setMode('triangles');
$('addPoint').onclick=()=>{
 if(points.length>=100)return showStatus('الحد الأقصى 100 زاوية.',true);
 const n=points.length;
 points.push(n?{x:String((parse(points[n-1].x)||0)+10),y:String(parse(points[n-1].y)||0)}:{x:'0',y:'0'});
 renderInputs();update();
};
$('loadExample').onclick=()=>{points=[{x:'0',y:'0'},{x:'35',y:'0'},{x:'44',y:'22'},{x:'20',y:'35'},{x:'0',y:'20'}];renderInputs();update()};
$('clearPoints').onclick=()=>{if(!confirm('هل تريد مسح جميع الزوايا؟'))return;points=[];renderInputs();update()};
$('addTriangle').onclick=()=>{if(triangles.length>=100)return showStatus('الحد الأقصى 100 مثلث.',true);triangles.push({a:'15',b:'20',c:'25'});renderInputs();update()};
$('exampleTriangles').onclick=()=>{triangles=[{a:'3',b:'4',c:'5'},{a:'5',b:'5',c:'6'}];renderInputs();update()};
$('clearTriangles').onclick=()=>{if(!confirm('هل تريد مسح المثلثات؟'))return;triangles=[];renderInputs();update()};
$('landDiagram').addEventListener('click',e=>{
 if(mode!=='coordinates'||!diagramTransform||points.length>=100)return;
 const svg=$('landDiagram'),rect=svg.getBoundingClientRect();
 if(rect.width<=0||rect.height<=0)return;
 const sx=(e.clientX-rect.left)*480/rect.width,sy=(e.clientY-rect.top)*330/rect.height;
 if(sx<10||sx>470||sy<10||sy>320)return;
 const {scale,centerX,centerY}=diagramTransform;
 const x=centerX+(sx-240)/scale,y=centerY-(sy-165)/scale;
 points.push({x:String(Number(x.toFixed(3))),y:String(Number(y.toFixed(3)))});
 renderInputs();update();
});
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