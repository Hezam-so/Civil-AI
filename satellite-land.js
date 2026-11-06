'use strict';
(()=>{
const $=id=>document.getElementById(id),G=window.CivilSatelliteGeometry,L=window.L;
if(!G||!L){$('mapStatus').textContent='تعذر تحميل مكتبة الخرائط أو محرك القياس. تأكد من الإنترنت، ثم حدّث الصفحة.';return}
const fmt=(v,n=3)=>Number.isFinite(v)?new Intl.NumberFormat('en-US',{maximumFractionDigits:n}).format(v):'—';
const parse=v=>String(v).trim()===''?NaN:Number(v);
const unitFactors={m2:1,labna:44.44,dhamar:114.49,amran:64,taiz:20.25,ibb:56.25,ha:10000,acre:4046.8564224,ft2:.09290304};
let coords=[],saved=[],undoStack=[],current=null,mode='add',markers=[],selected=-1;
const showStatus=(message,error=false)=>{
 const el=$('mapStatus');el.textContent=message;el.classList.toggle('error',Boolean(error));
};
const map=L.map('satelliteMap',{center:[15.5,44.2],zoom:7,zoomControl:true,preferCanvas:true,doubleClickZoom:false});
const satellite=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{
 maxZoom:19,attribution:'Tiles © Esri — Sources: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
});
const streets=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
 maxZoom:19,attribution:'© OpenStreetMap contributors'
});
satellite.addTo(map);
const boundary=L.polygon([],{color:'#f1b84c',weight:3,fillColor:'#18b6aa',fillOpacity:.17}).addTo(map);
const edgeLayer=L.layerGroup().addTo(map);
const markerLayer=L.layerGroup().addTo(map);
function history(){
 undoStack.push(coords.map(p=>({...p})));
 if(undoStack.length>45)undoStack.shift();
}
function selectMode(next){
 mode=next;
 $('addMode').setAttribute('aria-pressed',String(next==='add'));
 $('moveMode').setAttribute('aria-pressed',String(next==='move'));
 const el=map.getContainer();el.style.cursor=next==='add'?'crosshair':'grab';
 showStatus(next==='add'?'اضغط على زوايا الأرض بالترتيب لإضافة النقاط.':'حرّك الخريطة أو اسحب أي علامة مرقمة لتعديل زوايا الأرض.');
}
function angleLatLng(p){return [p.lat,p.lng]}
function icon(i){
 return L.divIcon({className:'survey-pin'+(selected===i?' selected':''),html:'<div>'+(i+1)+'</div>',iconSize:[30,30],iconAnchor:[15,15]});
}
function distanceTooltip(a,b){
 const length=G.distance(a,b);
 return fmt(length,length<10?2:1)+' م';
}
function renderEdges(){
 edgeLayer.clearLayers();
 if(coords.length<2)return;
 const result=G.validate(coords),edgeCount=result.valid?coords.length:coords.length-1;
 for(let i=0;i<edgeCount;i++){
  const a=coords[i],b=coords[(i+1)%coords.length];
  if(!a||!b)continue;
  L.polyline([angleLatLng(a),angleLatLng(b)],{color:'#f4c96e',weight:3,opacity:.9,interactive:false}).addTo(edgeLayer);
  const center=L.latLng((a.lat+b.lat)/2,(a.lng+b.lng)/2);
  L.tooltip({permanent:true,direction:'center',className:'distance-tooltip',interactive:false,opacity:.95})
   .setLatLng(center).setContent(distanceTooltip(a,b)).addTo(edgeLayer);
 }
}
function paint(){
 boundary.setLatLngs(coords.map(angleLatLng));
 renderEdges();markerLayer.clearLayers();markers=[];
 coords.forEach((p,i)=>{
  const marker=L.marker(angleLatLng(p),{icon:icon(i),draggable:true,autoPan:true,zIndexOffset:120}).addTo(markerLayer);
  marker.on('click',()=>{selected=i;refresh()});
  let old=null;
  marker.on('dragstart',()=>{old=coords.map(p=>({...p}));});
  marker.on('drag',e=>{
   const pos=e.target.getLatLng();
   coords[i]={lat:Number(pos.lat.toFixed(8)),lng:Number(pos.lng.toFixed(8))};
   const checked=G.validate(coords);
   boundary.setLatLngs(coords.map(angleLatLng));
   renderEdges();
   setNumbers(checked,true);
  });
  marker.on('dragend',e=>{
   if(old)undoStack.push(old);
   old=null;
   const result=G.validate(coords);
   if(!result.valid&&coords.length>=3){
    // Reject invalid geometry but retain insufficient-vertex state during free drawing.
    coords=undoStack.pop()||coords;
    showStatus('السحب أدى إلى مضلع متقاطع أو غير صالح. أُعيدت النقطة إلى مكانها.',true);
   }
   selected=i;refresh();
  });
  markers.push(marker);
 });
}
function setNumbers(result,whileDragging=false){
 current=result.valid?result:null;
 $('areaMain').textContent=current?fmt(current.area,2):'—';
 $('hectares').textContent=current?fmt(current.area/10000,6):'—';
 $('labna').textContent=current?fmt(current.area/44.44,5):'—';
 $('acres').textContent=current?fmt(current.area/4046.8564224,6):'—';
 $('perimeter').textContent=current?fmt(current.perimeter,2):'—';
 const u=$('resultUnit').value;
 $('converted').value=current?fmt(current.area/(unitFactors[u]||1),7):'';
 $('saveProject').disabled=!current;
 if(!whileDragging){
  if(current)showStatus('تم حساب قطعة من '+coords.length+' نقاط. المساحة تقديرية بحسب إحداثيات الصورة.');
  else showStatus(result.reason||'أضف ثلاث نقاط أو أكثر لبدء القياس.',coords.length>=3);
 }
}
function renderTable(){
 const tbody=$('pointRows');tbody.replaceChildren();
 coords.forEach((p,i)=>{
  const tr=document.createElement('tr');
  const label=document.createElement('td');label.textContent='P'+(i+1);
  tr.append(label);
  for(const key of ['lat','lng']){
   const td=document.createElement('td'),inp=document.createElement('input');
   inp.type='number';inp.step='any';inp.inputMode='decimal';inp.value=String(p[key]);inp.setAttribute('aria-label',key+' زاوية '+(i+1));
   inp.onchange=()=>{
    const v=parse(inp.value),invalid=!Number.isFinite(v)||(key==='lat'?Math.abs(v)>85:Math.abs(v)>180);
    if(invalid){showStatus('قيمة خط العرض أو الطول غير صالحة.',true);inp.value=String(coords[i][key]);return;}
    const candidate=coords.map(c=>({...c}));candidate[i][key]=v;
    const check=G.validate(candidate);
    if(coords.length>=3&&!check.valid){showStatus('إحداثيات الزاوية الجديدة تجعل حدود القطعة غير صالحة.',true);inp.value=String(coords[i][key]);return}
    history();coords=candidate;refresh();
   };
   td.append(inp);tr.append(td);
  }
  const td=document.createElement('td'),del=document.createElement('button');
  del.textContent='×';del.type='button';del.title='حذف النقطة P'+(i+1);
  del.style.cssText='background:#703e45;color:#fff;border:0;border-radius:6px;padding:5px 9px';
  del.onclick=()=>{history();coords.splice(i,1);selected=-1;refresh()};
  td.append(del);tr.append(td);tbody.append(tr);
 });
}
function refresh(){
 const result=G.validate(coords);
 paint();renderTable();setNumbers(result);
}
map.on('click',e=>{
 if(mode!=='add')return;
 if(coords.length>=100)return showStatus('الحد الأقصى 100 زاوية.',true);
 if(!Number.isFinite(e.latlng.lat)||Math.abs(e.latlng.lat)>85||Math.abs(e.latlng.lng)>180)return;
 history();
 coords.push({lat:Number(e.latlng.lat.toFixed(8)),lng:Number(e.latlng.lng.toFixed(8))});
 selected=coords.length-1;refresh();
});
$('addMode').onclick=()=>selectMode('add');
$('moveMode').onclick=()=>selectMode('move');
$('undoPoint').onclick=()=>{if(!undoStack.length)return showStatus('لا توجد خطوة سابقة.');coords=undoStack.pop();selected=-1;refresh()};
$('clearPoints').onclick=()=>{
 if(!coords.length)return;
 if(!confirm('هل تريد مسح نقاط الأرض من الخريطة؟'))return;
 history();coords=[];selected=-1;refresh();
};
$('satelliteLayer').onclick=()=>{
 if(map.hasLayer(streets))map.removeLayer(streets);
 if(!map.hasLayer(satellite))satellite.addTo(map);
 $('satelliteLayer').setAttribute('aria-pressed','true');
 $('streetLayer').setAttribute('aria-pressed','false');
};
$('streetLayer').onclick=()=>{
 if(map.hasLayer(satellite))map.removeLayer(satellite);
 if(!map.hasLayer(streets))streets.addTo(map);
 $('satelliteLayer').setAttribute('aria-pressed','false');
 $('streetLayer').setAttribute('aria-pressed','true');
};
$('jumpTo').onclick=()=>{
 const lat=parse($('jumpLat').value),lng=parse($('jumpLng').value);
 if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>85||Math.abs(lng)>180)return showStatus('أدخل إحداثيات صحيحة لخط العرض وخط الطول.',true);
 map.setView([lat,lng],Math.max(17,map.getZoom()),{animate:true});
 showStatus('انتقلت الخريطة إلى الإحداثيات المختارة. اضغط على حدود الأرض لتحديد زواياها.');
};
$('locateMe').onclick=()=>{
 if(!navigator.geolocation)return showStatus('المتصفح لا يدعم تحديد الموقع.',true);
 showStatus('يطلب المتصفح إذن تحديد موقعك؛ لن نبدأ إلا بموافقتك.');
 navigator.geolocation.getCurrentPosition(pos=>{
  map.setView([pos.coords.latitude,pos.coords.longitude],19,{animate:true});
  showStatus('تم تقريب الخريطة إلى موقع الجهاز. دقة GPS لا تضمن حدود الأرض.');
 },err=>showStatus('تعذر تحديد الموقع أو لم تمنح الإذن: '+err.message,true),{enableHighAccuracy:true,timeout:14000,maximumAge:0});
};
$('resultUnit').onchange=()=>setNumbers(G.validate(coords));
$('copyResult').onclick=async()=>{
 if(!current)return showStatus('حدد ثلاث زوايا صحيحة أولًا.',true);
 const title=$('projectTitle').value||'قياس الأرض';
 const summary=title+'\nالمساحة: '+fmt(current.area,4)+' م²\nالمحيط: '+fmt(current.perimeter,3)+' م\n'+
 coords.map((p,i)=>'P'+(i+1)+': '+p.lat.toFixed(8)+', '+p.lng.toFixed(8)).join('\n');
 try{await navigator.clipboard.writeText(summary);showStatus('تم نسخ القياسات إلى الحافظة.')}catch{showStatus('تعذر نسخ القياسات في المتصفح.',true)}
};
$('printResult').onclick=()=>window.print();
$('saveProject').onclick=async()=>{
 if(!current)return showStatus('لا يمكن حفظ قياس غير صالح.',true);
 const title=$('projectTitle').value.trim().slice(0,120)||'أرض مقاسة من الخريطة';
 const data={type:'satellite-land',method:'geodesic-satellite-map',points:coords.map(p=>({...p})),
 area:current.area,perimeter:current.perimeter,edges:current.edges,unit:'m2',createdAt:new Date().toISOString(),
 note:'Approximate geodesic area from user-selected satellite/map coordinates; not a certified cadastral survey.'};
 const btn=$('saveProject');btn.disabled=true;
 try{
  const r=await fetch('/api/projects?action=create',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,type:'satellite-land',data})});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(j.error||'HTTP '+r.status);
  showStatus('حُفظ قياس الأرض في حسابك الخاص. يمكنك استعادته من أي جهاز بعد تسجيل الدخول.');
 }catch(e){showStatus('تعذر حفظ المشروع: '+e.message,true)}
 finally{btn.disabled=false}
};
$('loadProjects').onclick=async()=>{
 $('loadProjects').disabled=true;
 try{
  const r=await fetch('/api/projects?action=list',{credentials:'same-origin',cache:'no-store'});
  const j=await r.json();if(!r.ok)throw Error(j.error||'HTTP '+r.status);
  saved=(j.projects||[]).filter(p=>p.type==='satellite-land'&&Array.isArray(p.data?.points)&&p.data.points.length>=3);
  const sel=$('savedProjects');sel.replaceChildren();
  const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent=saved.length?'اختر القياس المحفوظ':'لا توجد قياسات محفوظة من الأقمار الصناعية';sel.append(placeholder);
  saved.forEach((p,i)=>{
   const o=document.createElement('option');o.value=String(i);
   o.textContent=p.title+' · '+new Date(p.createdAt).toLocaleDateString('ar');sel.append(o);
  });
  showStatus('عُثر على '+saved.length+' مشروع محفوظ لقياس الأرض عبر الخريطة.');
 }catch(e){showStatus('تعذر قراءة القياسات المحفوظة: '+e.message,true)}
 finally{$('loadProjects').disabled=false}
};
$('restoreProject').onclick=()=>{
 const i=$('savedProjects').value,p=saved[Number(i)];
 if(i===''||!p)return showStatus('اختر مشروعًا محفوظًا أولًا.',true);
 const points=p.data.points.map(c=>({lat:Number(c.lat),lng:Number(c.lng)}));
 if(!G.validate(points).valid)return showStatus('إحداثيات هذا المشروع غير صالحة.',true);
 history();coords=points;selected=-1;$('projectTitle').value=p.title;refresh();
 map.fitBounds(L.latLngBounds(coords.map(angleLatLng)),{padding:[40,40],maxZoom:19});
 showStatus('استُعيدت حدود المشروع المحفوظ: '+p.title);
};
refresh();selectMode('add');
setTimeout(()=>map.invalidateSize(),300);
})();