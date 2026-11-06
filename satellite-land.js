'use strict';
(()=>{
const $=id=>document.getElementById(id),G=window.CivilSatelliteGeometry,L=window.L,Export=window.CivilSatelliteExport,StreetEdges=window.CivilStreetEdges;
if(!G||!L){$('mapStatus').textContent='تعذر تحميل مكتبة الخرائط أو محرك القياس. تأكد من الإنترنت، ثم حدّث الصفحة.';return}
const fmt=(v,n=3)=>Number.isFinite(v)?new Intl.NumberFormat('en-US',{maximumFractionDigits:n}).format(v):'—';
const parse=v=>String(v).trim()===''?NaN:Number(v);
const unitFactors={m2:1,labna:44.44,dhamar:114.49,amran:64,taiz:20.25,ibb:56.25,ha:10000,acre:4046.8564224,ft2:.09290304};
let coords=[],saved=[],undoStack=[],current=null,mode='add',markers=[],selected=-1;
let roads=[],activeRoad=[],roadMarkers=[],nearbyRoads=[],nearbyRequest=null,nearbyBasis='';
const chosenSides=()=>Array.from(document.querySelectorAll('.street-dir:checked')).map(el=>el.value);
const nearbyAdjacent=()=>StreetEdges&&nearbyBasis===parcelSignature()
 ?StreetEdges.classify(nearbyRoads,coords,{maxDistance:55,maxRoads:8}):[];
function updateRoadPreview(){
 nearbyPreview.clearLayers();
 const selected=$('includeNearbyRoads').checked;
 const candidates=selected?nearbyAdjacent():[];
 candidates.forEach(road=>{
  L.polyline(road.points.map(p=>[p.lat,p.lng]),{color:'#b258e6',weight:4,opacity:.9,dashArray:'5 5',interactive:false}).addTo(nearbyPreview);
 });
 const bySide={};
 candidates.forEach(road=>(bySide[road.side]??=[]).push(road.name));
 $('nearbyPreview').textContent=candidates.length
  ?('شوارع بجوار الأرض: '+Object.entries(bySide).map(([side,names])=>side+' ('+names.slice(0,2).join('، ')+')').join(' — '))
  :selected?'لم يتم العثور على شارع موثّق ملاصق أو قريب من حدود هذه القطعة ضمن 55 مترًا؛ يمكنك تحديد الجهات يدويًا.'
    :'سيظهر هنا وصف الشوارع المجاورة عند تفعيل الخيار وجلب البيانات.';
}

const parcelSignature=()=>coords.map(p=>p.lat.toFixed(8)+','+p.lng.toFixed(8)).join('|');
function roadBounds(){
 if(coords.length<3||!current)return null;
 const lat=coords.map(p=>p.lat),lng=coords.map(p=>p.lng);
 const midLat=(Math.min(...lat)+Math.max(...lat))/2;
 const padLat=130/111195,padLon=130/(111195*Math.max(.15,Math.cos(midLat*Math.PI/180)));
 return [Math.max(-85,Math.min(...lat)-padLat),Math.max(-180,Math.min(...lng)-padLon),Math.min(85,Math.max(...lat)+padLat),Math.min(180,Math.max(...lng)+padLon)];
}
function parseOSMRoads(elements,bbox){
 const list=[],ids=new Set(),[south,west,north,east]=bbox;
 // Clip every line segment to the parcel neighbourhood; preserve roads crossing the
 // bounding box even if neither original OSM node lies within it.
 const clipped=(a,b)=>{
  let lo=0,hi=1;const dx=b.lng-a.lng,dy=b.lat-a.lat;
  for(const [p,q] of [[-dx,a.lng-west],[dx,east-a.lng],[-dy,a.lat-south],[dy,north-a.lat]]){
   if(Math.abs(p)<1e-15){if(q<0)return null;continue}
   const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);
   if(lo>hi)return null;
  }
  return [{lat:a.lat+lo*dy,lng:a.lng+lo*dx},{lat:a.lat+hi*dy,lng:a.lng+hi*dx}];
 };
 for(const way of (Array.isArray(elements)?elements:[])){
  if(way.type!=='way'||!way.tags?.highway||!Array.isArray(way.geometry)||ids.has(way.id))continue;
  if(/^(footway|path|steps|cycleway|pedestrian|corridor|platform|construction|proposed)$/.test(way.tags.highway))continue;
  const geom=way.geometry.filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon)).slice(0,2000).map(p=>({lat:p.lat,lng:p.lon}));
  let part=[];
  const store=()=>{
   if(part.length>1){
    ids.add(way.id);
    const width=Number.parseFloat(way.tags.width);
    list.push({name:String(way.tags['name:ar']||way.tags.name||'شارع غير مسمى').slice(0,80),source:'OpenStreetMap',
     osmId:way.id,width:Number.isFinite(width)&&width>0&&width<100?width:null,points:part.slice(0,100)});
   }
   part=[];
  };
  for(let j=0;j<geom.length-1;j++){
   const p=clipped(geom[j],geom[j+1]);
   if(!p){store();continue}
   const a={lat:Number(p[0].lat.toFixed(8)),lng:Number(p[0].lng.toFixed(8))};
   const b={lat:Number(p[1].lat.toFixed(8)),lng:Number(p[1].lng.toFixed(8))};
   if(!part.length)part.push(a);
   else if(Math.hypot(part[part.length-1].lat-a.lat,part[part.length-1].lng-a.lng)>1e-7){store();part.push(a)}
   part.push(b);
   if(part.length>=100)store();
  }
  store();
  if(list.length>=30)break;
 }
 return list.slice(0,30);
}
function exportRoads(){
 const manual=cloneRoads();
 return $('includeNearbyRoads').checked&&nearbyBasis===parcelSignature()?manual.concat(nearbyAdjacent()).slice(0,70):manual;
}
const cloneRoads=()=>roads.map(r=>({name:r.name,width:r.width,points:r.points.map(p=>({...p}))}));
const snapshot=()=>({coords:coords.map(p=>({...p})),roads:cloneRoads(),activeRoad:activeRoad.map(p=>({...p}))});
const restore=state=>{
 if(Array.isArray(state)){coords=state;roads=[];activeRoad=[];return}
 coords=state.coords.map(p=>({...p}));roads=state.roads.map(r=>({name:r.name,width:r.width,points:r.points.map(p=>({...p}))}));activeRoad=state.activeRoad.map(p=>({...p}));
};
function downloadFile(content,extension,mime){
 const title=String($('projectTitle').value||'civil-ai-land').trim().replace(/[^a-zA-Z0-9_-]+/g,'_').slice(0,45)||'civil-ai-land';
 const blob=new Blob([content],{type:mime}),url=URL.createObjectURL(blob);
 const link=document.createElement('a');link.href=url;link.download=title+'.'+extension;
 document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
const showStatus=(message,error=false)=>{
 const el=$('mapStatus');el.textContent=message;el.classList.toggle('error',Boolean(error));
};
const map=L.map('satelliteMap',{center:[15.5,44.2],zoom:7,maxZoom:23,zoomSnap:.5,zoomDelta:.5,zoomControl:true,preferCanvas:true,doubleClickZoom:false});
const satellite=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{
 maxNativeZoom:22,maxZoom:23,attribution:'Tiles © Esri — Sources: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
});
const streets=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
 maxNativeZoom:19,maxZoom:23,attribution:'© OpenStreetMap contributors'
});
satellite.addTo(map);
const boundary=L.polygon([],{color:'#f1b84c',weight:3,fillColor:'#18b6aa',fillOpacity:.17}).addTo(map);
const edgeLayer=L.layerGroup().addTo(map);
const markerLayer=L.layerGroup().addTo(map);
const roadLayer=L.layerGroup().addTo(map);
const nearbyPreview=L.layerGroup().addTo(map);
function history(){
 undoStack.push(snapshot());
 if(undoStack.length>45)undoStack.shift();
}
function selectMode(next){
 mode=next;
 $('addMode').setAttribute('aria-pressed',String(next==='add'));
 $('moveMode').setAttribute('aria-pressed',String(next==='move'));
 $('roadMode').setAttribute('aria-pressed',String(next==='road'));
 const el=map.getContainer();el.style.cursor=next==='add'||next==='road'?'crosshair':'grab';
 showStatus(next==='add'?'اضغط على زوايا الأرض بالترتيب لإضافة النقاط.':next==='road'?'اضغط على الخريطة لتحديد مسار الشارع، ثم اختر «إنهاء الشارع».':'حرّك الخريطة أو اسحب أي علامة مرقمة لتعديل زوايا الأرض.');
}
function angleLatLng(p){return [p.lat,p.lng]}
function icon(i){
 return L.divIcon({className:'survey-pin'+(selected===i?' selected':''),html:'<div>'+(i+1)+'</div>',iconSize:[28,28],iconAnchor:[14,14]});
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
function renderRoads(){
 roadLayer.clearLayers();roadMarkers=[];
 const all=roads.map((r,i)=>({...r,roadIndex:i,active:false})).concat(activeRoad.length?[
 {name:$('roadName').value.trim()||'Road '+(roads.length+1),points:activeRoad,roadIndex:-1,active:true}
 ]:[]);
 all.forEach(road=>{
  if(road.points.length>=2){
   L.polyline(road.points.map(angleLatLng),{color:road.active?'#f3cb79':'#fa7361',weight:4,opacity:.92,interactive:false,dashArray:road.active?'8 5':null}).addTo(roadLayer);
  }
  road.points.forEach((p,j)=>{
   const mark=L.circleMarker(angleLatLng(p),{radius:4,color:'#ffffff',weight:1.1,fillColor:'#fa7361',fillOpacity:1}).addTo(roadLayer);
   // Road vertices are editable by dragging a separate small Leaflet marker.
   if(!road.active){
    const dragIcon=L.divIcon({className:'survey-pin road-pin',html:'<div>•</div>',iconSize:[15,15],iconAnchor:[7.5,7.5]});
    const edit=L.marker(angleLatLng(p),{icon:dragIcon,draggable:true,zIndexOffset:95}).addTo(roadLayer);
    let before=null;
    edit.on('dragstart',()=>{before=snapshot()});
    edit.on('drag',e=>{
     const v=e.target.getLatLng();
     roads[road.roadIndex].points[j]={lat:Number(v.lat.toFixed(8)),lng:Number(v.lng.toFixed(8))};
  
    });
    edit.on('dragend',()=>{
     if(before){undoStack.push(before);if(undoStack.length>45)undoStack.shift()}
     renderRoads();
    });
    roadMarkers.push(edit);
   }
  });
 });
 $('roadSummary').textContent=roads.length+' شوارع محفوظة في الرسم، '+activeRoad.length+' نقاط في الشارع الحالي. خطوط الشوارع مرسومة يدويًا (باللون الأحمر).';
}
function paint(){
 boundary.setLatLngs(coords.map(angleLatLng));
 renderEdges();markerLayer.clearLayers();markers=[];
 renderRoads();
 coords.forEach((p,i)=>{
  const marker=L.marker(angleLatLng(p),{icon:icon(i),draggable:true,autoPan:true,zIndexOffset:120}).addTo(markerLayer);
  marker.on('click',()=>{selected=i;refresh()});
  let old=null;
  marker.on('dragstart',()=>{old=snapshot();});
  marker.on('drag',e=>{
   const pos=e.target.getLatLng();
   coords[i]={lat:Number(pos.lat.toFixed(8)),lng:Number(pos.lng.toFixed(8))};
   const checked=G.validate(coords);
   boundary.setLatLngs(coords.map(angleLatLng));
   renderEdges();
   setNumbers(checked,true);
  });
  marker.on('dragend',e=>{
   if(old){undoStack.push(old);if(undoStack.length>45)undoStack.shift()}
   old=null;
   const result=G.validate(coords);
   if(!result.valid&&coords.length>=3){
    // Reject invalid geometry but retain insufficient-vertex state during free drawing.
    const previous=undoStack.pop();if(previous)restore(previous);
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
 if(nearbyBasis&&nearbyBasis!==parcelSignature()){
  nearbyRoads=[];nearbyBasis='';
  $('nearbyRoadStatus').textContent='تغيّرت حدود الأرض. فعّل الخيار مرة أخرى أو اضغط جلب الشوارع لتحديث الطرق المجاورة.';
 }
 const result=G.validate(coords);
 paint();renderTable();setNumbers(result);updateRoadPreview();
}
map.on('click',e=>{
 if(mode==='road'){
  if(roads.length>=50||activeRoad.length>=100)return showStatus('وصلت إلى الحد الأعلى لرسم الشوارع.',true);
  const p={lat:Number(e.latlng.lat.toFixed(8)),lng:Number(e.latlng.lng.toFixed(8))};
  if(!Number.isFinite(p.lat)||!Number.isFinite(p.lng)||Math.abs(p.lat)>85||Math.abs(p.lng)>180)return;
  history();activeRoad.push(p);renderRoads();
  showStatus('أُضيفت نقطة إلى مسار الشارع ('+activeRoad.length+'). اضغط «إنهاء الشارع» عندما تنتهي.');
  return;
 }
 if(mode!=='add')return;
 if(coords.length>=100)return showStatus('الحد الأقصى 100 زاوية.',true);
 if(!Number.isFinite(e.latlng.lat)||Math.abs(e.latlng.lat)>85||Math.abs(e.latlng.lng)>180)return;
 history();
 coords.push({lat:Number(e.latlng.lat.toFixed(8)),lng:Number(e.latlng.lng.toFixed(8))});
 selected=coords.length-1;refresh();
});
$('addMode').onclick=()=>selectMode('add');
$('moveMode').onclick=()=>selectMode('move');
$('roadMode').onclick=()=>selectMode('road');
$('finishRoad').onclick=()=>{
 if(activeRoad.length<2)return showStatus('ارسم نقطتين على الأقل لتحديد محور الشارع.',true);
 const width=parse($('roadWidth').value);
 if(!Number.isFinite(width)||width<=0||width>100)return showStatus('عرض الشارع يجب أن يكون أكبر من صفر وأقل من أو يساوي 100 متر.',true);
 history();
 roads.push({name:$('roadName').value.trim().slice(0,80)||'Road '+(roads.length+1),width,points:activeRoad.map(p=>({...p}))});
 activeRoad=[];$('roadName').value='Road '+(roads.length+1);renderRoads();selectMode('move');
 showStatus('تم إنهاء الشارع وإضافته إلى المخطط والتصدير.');
};
$('clearRoads').onclick=()=>{
 if(!roads.length&&!activeRoad.length)return;
 if(!confirm('حذف جميع الشوارع المرسومة؟'))return;
 history();roads=[];activeRoad=[];renderRoads();showStatus('تم مسح الشوارع، مع الاحتفاظ بحدود الأرض.');
};
$('undoPoint').onclick=()=>{if(!undoStack.length)return showStatus('لا توجد خطوة سابقة.');restore(undoStack.pop());selected=-1;refresh()};
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
 area:current.area,perimeter:current.perimeter,edges:current.edges,roads:cloneRoads(),unit:'m2',createdAt:new Date().toISOString(),
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
 history();coords=points;nearbyRoads=[];nearbyBasis='';$('includeNearbyRoads').checked=false;roads=Array.isArray(p.data.roads)?p.data.roads.slice(0,50).map(r=>({name:String(r.name||'Road').slice(0,80),width:Number(r.width)||8,points:(r.points||[]).slice(0,100).map(q=>({lat:Number(q.lat),lng:Number(q.lng)}))})).filter(r=>r.points.length>=2):[];activeRoad=[];selected=-1;$('projectTitle').value=p.title;refresh();
 map.fitBounds(L.latLngBounds(coords.map(angleLatLng)),{padding:[40,40],maxZoom:22});
 showStatus('استُعيدت حدود المشروع المحفوظ: '+p.title);
};
const canExport=()=>{
 if(!Export||typeof Export.createDXF!=='function'||typeof Export.createPDF!=='function'){showStatus('محرك التصدير غير متاح. حدّث الصفحة.',true);return false}
 if(!current){showStatus('يجب إكمال حدود أرض صالحة قبل تنزيل المخطط.',true);return false}
 return true;
};
function exportData(){return{points:coords,title:$('projectTitle').value.trim()||'مخطط أرض',roads:exportRoads(),streetDirections:chosenSides()}}
async function prepareExport(){
 if(!canExport())return false;
 if($('includeNearbyRoads').checked&&nearbyBasis!==parcelSignature()){
  await $('loadNearbyRoads').onclick();
 }
 if($('includeNearbyRoads').checked&&nearbyAdjacent().length===0&&roads.length===0&&chosenSides().length===0){
  showStatus('لا توجد شوارع موثقة مجاورة لإضافتها. حدّد جهة الشوارع يدويًا أو ارسم الشوارع، أو ألغِ خيار الشوارع التلقائية قبل التصدير.',true);
  return false;
 }
 return true;
}
$('exportDXF').onclick=async()=>{
 if(!await prepareExport())return;
 try{downloadFile(Export.createDXF(exportData(),G),'dxf','application/dxf');showStatus('تم تجهيز ملف DXF قابل للتعديل في AutoCAD؛ الشوارع والأبعاد وسهم الشمال في طبقات مستقلة.')}
 catch(e){showStatus('تعذر إنشاء DXF: '+e.message,true)}
};
$('includeNearbyRoads').onchange=()=>{
 updateRoadPreview();
 if($('includeNearbyRoads').checked&&(!nearbyRoads.length||nearbyBasis!==parcelSignature()))return $('loadNearbyRoads').onclick();
 $('nearbyRoadStatus').textContent=$('includeNearbyRoads').checked
  ?('مفعّل: سيتم تضمين '+nearbyRoads.length+' شارعًا من OpenStreetMap في التصدير فقط. اضغط «جلب الشوارع» لتحديث البيانات.')
  :'تم إيقاف تضمين الشوارع المستخرجة؛ ستُصدّر الشوارع المرسومة يدويًا فقط.';
};
$('loadNearbyRoads').onclick=async()=>{
 if(!current)return showStatus('حدد حدود قطعة أرض صالحة قبل استيراد الشوارع.',true);
 const box=roadBounds();if(!box)return;
 const query='[out:json][timeout:15];way["highway"]('+box.map(v=>v.toFixed(7)).join(',')+');out geom;';
 const button=$('loadNearbyRoads');button.disabled=true;
 nearbyRequest?.abort();
 const ctrl=new AbortController();nearbyRequest=ctrl;
 const timeout=setTimeout(()=>ctrl.abort(),17500);
 $('nearbyRoadStatus').textContent='جارٍ جلب محاور الطرق من OpenStreetMap ...';
 try{
  let response;
  const urls=['https://overpass.private.coffee/api/interpreter','https://overpass-api.de/api/interpreter'];
  for(const endpoint of urls){
   try{
    response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},
      body:'data='+encodeURIComponent(query),signal:ctrl.signal});
    if(response.ok)break;
   }catch(err){if(ctrl.signal.aborted)throw err;}
  }
  if(!response?.ok)throw Error('خدمة بيانات الطرق غير متاحة حاليًا.');
  const payload=await response.json();
  if(ctrl.signal.aborted||nearbyBasis&&nearbyBasis!==parcelSignature())throw Error('تم تغيير حدود الأرض أثناء جلب الطرق؛ أعد المحاولة.');
  nearbyRoads=parseOSMRoads(payload.elements,box);
  nearbyBasis=parcelSignature();$('includeNearbyRoads').checked=true;updateRoadPreview();
  $('nearbyRoadStatus').textContent='تم جلب '+nearbyRoads.length+' شارعًا من OpenStreetMap. ستظهر في DXF وPDF فقط عند تفعيل مربع الاختيار. البيانات تقريبية وقد تكون ناقصة.';
  const count=nearbyAdjacent().length;
  showStatus(count?'تم تحديد '+count+' شارعًا مجاورًا، وستظهر اتجاهاته في الملفات.':'لم نجد شوارع موثقة قريبة من حدود القطعة. يمكنك تحديد الجهات يدويًا أو رسم الشوارع مباشرة.',!count);
 }catch(err){
  nearbyRoads=[];nearbyBasis='';updateRoadPreview();
  $('nearbyRoadStatus').textContent='تعذر استيراد الشوارع: '+(ctrl.signal.aborted?'انتهت مهلة الخادم.':err.message)+' يمكنك رسم الشوارع يدويًا بدلًا من ذلك.';
 }finally{clearTimeout(timeout);if(nearbyRequest===ctrl)nearbyRequest=null;button.disabled=false}
};
$('zoomCloser').onclick=()=>map.setZoom(Math.min(23,map.getZoom()+1));
$('tryNativeImagery').onchange=()=>{
 satellite.options.maxNativeZoom=$('tryNativeImagery').checked?22:19;
 satellite.redraw();
 $('imageryInfo').textContent=$('tryNativeImagery').checked
  ?'يحاول تحميل تفاصيل أصلية أعلى حتى المستوى 22 إن وفرها المزود، ويعود تلقائيًا إلى تكبير الصورة الحالية إذا لم تتوفر.'
  :'عرض الصور الأصلية حتى المستوى 19 فقط؛ التكبير الأكبر سيُكبّر البكسلات دون تفاصيل جديدة.';
};
$('enhanceImagery').onchange=()=>{
 map.getContainer().classList.toggle('enhanced-imagery',$('enhanceImagery').checked);
};
let switchedToFallback=false;
satellite.on('tileerror',()=>{
 if(switchedToFallback||!$('tryNativeImagery').checked||map.getZoom()<20)return;
 switchedToFallback=true;
 satellite.options.maxNativeZoom=19;
 satellite.redraw();
 $('imageryInfo').textContent='هذا الموضع لا يدعم تحميل بلاطات أصلية أعلى عبر المزود الحالي، لذلك استُخدمت الصورة المتاحة مع استمرار التقريب. يمكن تفعيل تحسين التباين الظاهري.';
});
$('zoomSlider').oninput=e=>map.setZoom(Number(e.target.value),{animate:false});
map.on('zoomend',()=>{
 const z=map.getZoom();$('zoomSlider').value=z.toString();$('zoomLevel').textContent=z.toFixed(1);
});
$('exportPDF').onclick=async()=>{
 if(!await prepareExport())return;
 try{downloadFile(Export.createPDF(exportData(),G),'pdf','application/pdf');showStatus('تم تجهيز مخطط PDF متجهي قابل للطباعة.')}
 catch(e){showStatus('تعذر إنشاء PDF: '+e.message,true)}
};
refresh();selectMode('add');
setTimeout(()=>map.invalidateSize(),300);
})();