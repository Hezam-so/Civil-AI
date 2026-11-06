/* Deterministic engineering tools that extend Civil AI Copilot.
   These are quantity/geometry checks, not approved structural designs. */
'use strict';
const mix=require('../concrete-mix-core.js');
const geo=require('../irregular-land-core.js');
const knowledge=require('./civil-knowledge.js');
const n=(v,label,min=0,max=1e12)=>{
 if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error('Invalid '+label+'. Please provide a finite number in its stated units.');
 return v;
};
const round=v=>Number(v.toPrecision(9));
const output=(kind,title,result,formulae,assumptions)=>({kind,title,result,formulae,assumptions});
const specs={
 program_help:{
  description:'Look up accurate Civil AI app capabilities, module pages, steps, limitations, land tools, satellite map, DXF/PDF export, CAD viewer, Robot, files, projects, and navigation. Use instead of guessing app features.',
  properties:{query:{type:'string',description:'Question or keywords e.g. satellite map PDF export, الخرسانة، تطبيق'}},required:['query']
 },
 concrete_materials:{
  description:'Calculate concrete volume and approximate cement, fine/coarse aggregate, water, number of cement bags, and optional fly ash replacement and steel fiber mass using absolute volume method. No approved mix design; aggregates SSD.',
  properties:{areaM2:{type:'number',description:'Measured area (m²)'},thicknessM:{type:'number',description:'Thickness in m'},wastePercent:{type:'number'},binderKgM3:{type:'number',description:'Total initial cementitious binder kg/m³ (default 350)'},waterBinderRatio:{type:'number',description:'Water / cementitious ratio, default 0.5'},gravelKgM3:{type:'number',description:'Coarse aggregate SSD mass per m³, default 1050'},flyAshReplacementPercent:{type:'number',description:'Fly ash % mass replacing initial binder; optional'},steelFiberKgM3:{type:'number',description:'Steel fiber kg per m³; optional'},cementBagKg:{type:'number',description:'Bag size kg, default 50'}},required:['areaM2','thicknessM']
 },
 polygon_area:{
  description:'Compute verified planar polygon area and perimeter using supplied X,Y coordinates in METERS; rejects self-crossing polygons. Coordinates must be in a consistent metric projected plane, not raw latitude/longitude.',
  properties:{points:{type:'array',items:{type:'object',properties:{x:{type:'number'},y:{type:'number'}},required:['x','y'],additionalProperties:false},minItems:3,maxItems:100}},required:['points']
 },
 triangle_heron:{
  description:'Area and perimeter of a triangle from three side lengths in meters, with triangle inequality validation.',
  properties:{aM:{type:'number'},bM:{type:'number'},cM:{type:'number'}},required:['aM','bM','cM']
 },
 rebar_schedule:{
  description:'Compute theoretical rebar quantities and total mass for a single bar group; exact cylindrical mass based on steel density 7850 kg/m³.',
  properties:{diameterMm:{type:'number'},barLengthM:{type:'number'},quantity:{type:'number'},wastePercent:{type:'number'}},required:['diameterMm','barLengthM','quantity']
 },
 beam_deflection:{
  description:'Calculate simplified maximum elastic deflection of a simply supported prismatic beam for one full-span UDL or one CENTER point load, using E(GPa) and Ix(mm⁴). Also returns Mmax and shear; no code check or cracking.',
  properties:{spanM:{type:'number'},loadType:{type:'string',enum:['udl','center_point']},loadValue:{type:'number',description:'UDL in kN/m, or center point load kN'},elasticModulusGpa:{type:'number'},inertiaMm4:{type:'number'}},required:['spanM','loadType','loadValue','elasticModulusGpa','inertiaMm4']
 },
 yemeni_land_units:{
  description:'Convert m² to land units; Yemeni local units differ by governorate and may differ from legal deeds. Supported sanaa_labna 44.44 m², dhamar_labna 114.49 m², amran_labna 64 m², taiz_10_qasaba 20.25 m², hectare 10000 m² and acre 4046.8564224 m².',
  properties:{areaM2:{type:'number'},unit:{type:'string',enum:['sanaa_labna','dhamar_labna','amran_labna','taiz_10_qasaba','hectare','acre']}},required:['areaM2','unit']
 }
};
function calculate(kind,v={}){
 switch(kind){
  case 'program_help':{
   const query=String(v.query||'').slice(0,400);
   const list=knowledge.lookup(query);
   return output(kind,'دليل أدوات Civil AI', {pages:list.map(p=>({name:p.name,path:p.route,description:p.summary,limits:p.limits})),totalPages:knowledge.pages.length},[],['هذه المعلومات مستمدة من وظائف البرنامج المعروفة؛ قد تختلف بعض الواجهات بتحديثات النشر.']);
  }
  case 'concrete_materials':{
   const area=n(v.areaM2,'areaM2',.0001,1e7);
   const h=n(v.thicknessM,'thicknessM',.0001,500);
   const waste=n(v.wastePercent??5,'wastePercent',0,100);
   const volume=area*h*(1+waste/100);
   const binder=n(v.binderKgM3??350,'binderKgM3',50,1200);
   const wb=n(v.waterBinderRatio??.5,'waterBinderRatio',.15,1.5);
   const gravel=n(v.gravelKgM3??1050,'gravelKgM3',100,2000);
   const fly=n(v.flyAshReplacementPercent??0,'flyAshReplacementPercent',0,70);
   const fiber=n(v.steelFiberKgM3??0,'steelFiberKgM3',0,400);
   const bag=n(v.cementBagKg??50,'cementBagKg',1,100);
   const additives=[];
   if(fly)additives.push({group:'mineral',id:'fly-ash',dose:fly,unit:'replace_pct'});
   if(fiber)additives.push({group:'fiber',id:'steel',dose:fiber,unit:'kg_m3',density:7850});
   const r=mix.calculate({volume,binder,wb,gravel,air:2,cementDensity:3150,sandDensity:2650,gravelDensity:2700,bulkSand:1600,bulkGravel:1500,bagKg:bag,enabled:true,additives});
   return output(kind,'حصر كميات الخرسانة', {
    netVolumeM3:round(area*h),purchaseVolumeM3:round(volume),
    cementKg:round(r.cement*volume),cementBags:round(r.bags),sandKgSSD:round(r.sand*volume),
    sandLooseM3Approx:round(r.base[1].looseM3*volume),
    gravelKgSSD:round(r.gravel*volume),gravelLooseM3Approx:round(r.base[2].looseM3*volume),
    mixingWaterLitres:round(r.water*volume),flyAshKg:round(binder*fly/100*volume),steelFiberKg:round(fiber*volume)
   },['V = area × thickness × (1 + waste/100)','Each material total = approved trial mix quantity per m³ × V','SSD aggregate quantities estimated by absolute volume'],['هذه ليست خلطة خرسانية إنشائية معتمدة؛ القيم والكثافات الافتراضية قابلة للاختلاف.', 'يلزم تصحيح رطوبة الركام وماء الإضافات واختبار المتانة والمقاومة قبل التنفيذ.']);
  }
  case 'polygon_area':{
   if(!Array.isArray(v.points)||v.points.length<3||v.points.length>100)throw Error('Provide 3 to 100 polygon vertices.');
   const points=v.points.map(p=>({x:n(p.x,'x',-1e8,1e8),y:n(p.y,'y',-1e8,1e8)}));
   const r=geo.polygonArea(points);
   if(!r.valid)throw Error('Invalid polygon boundary: '+r.error+'. Check crossings and duplicate vertices.');
   return output(kind,'حساب مساحة أرض غير منتظمة',{areaM2:round(r.area),perimeterM:round(r.perimeter),vertices:points.length},['Shoelace area for planar coordinates','Perimeter = sum of adjacent edge lengths'],['يجب استعمال إحداثيات مستوية مترية من نفس النظام؛ لا تستخدم خطوط الطول والعرض مباشرة.','لا يُعد رفعًا مساحيًا قانونيًا.']);
  }
  case 'triangle_heron':{
   const r=geo.triangleSides(n(v.aM,'aM',.001,1e8),n(v.bM,'bM',.001,1e8),n(v.cM,'cM',.001,1e8));
   if(!r.valid)throw Error('Invalid triangle side lengths or triangle inequality.');
   return output(kind,'حساب المثلث',{areaM2:round(r.area),perimeterM:round(r.perimeter)},['s = (a+b+c)/2','Area = √[s(s−a)(s−b)(s−c)]'],['الأطوال بالمتر ومساحة مستوية.']);
  }
  case 'rebar_schedule':{
   const d=n(v.diameterMm,'diameterMm',3,100),L=n(v.barLengthM,'barLengthM',.001,1e6),q=n(v.quantity,'quantity',1,1e7);
   if(!Number.isInteger(q))throw Error('Quantity must be a whole number.');
   const waste=n(v.wastePercent??0,'wastePercent',0,100);
   const kgPerM=Math.PI/4*(d/1000)**2*7850;
   return output(kind,'حصر قضبان حديد التسليح',{diameterMm:d,barLengthM:L,barCount:q,totalLengthM:round(q*L),steelWeightKg:round(kgPerM*q*L),weightWithWasteKg:round(kgPerM*q*L*(1+waste/100)),kgPerM:round(kgPerM)},['m = π/4 × d² × density × total length'],['كثافة الحديد المفترضة 7850 kg/m³؛ وصلات التراكب والثنيات يجب إدخالها ضمن طول السيخ.']);
  }
  case 'beam_deflection':{
   const L=n(v.spanM,'spanM',.01,200),mode=v.loadType;
   if(!['udl','center_point'].includes(mode))throw Error('Unsupported beam load type.');
   const P=n(v.loadValue,'loadValue',0,1e8),E=n(v.elasticModulusGpa,'elasticModulusGpa',.001,1000)*1e9,I=n(v.inertiaMm4,'inertiaMm4',1,1e18)*1e-12;
   const w=mode==='udl'?P*1e3:0,F=mode==='center_point'?P*1e3:0;
   const delta=mode==='udl'?5*w*L**4/(384*E*I):F*L**3/(48*E*I);
   const V=P*L/2*(mode==='udl'?1:0)+P/2*(mode==='center_point'?1:0);
   const M=mode==='udl'?P*L**2/8:P*L/4;
   if(!Number.isFinite(delta)||delta>1e9)throw Error('Unreasonable deflection; check E, Ix and units.');
   return output(kind,'كمرة بسيطة: قص وعزم وترخيم مرن',{loadType:mode,maxMomentKnM:round(M),maxShearKn:round(V),maxDeflectionMm:round(delta*1000),spanToDeflectionRatio:delta>0?round(L/delta):null},[mode==='udl'?'δmax = 5wL⁴/(384EI)':'δmax = PL³/(48EI)','Simply supported one-span idealization'],['افتراضات: مرونة خطية، EI ثابت، حمل واحد، دون تشقق أو زحف أو قص أو تشوهات غير خطية.','الترخيم المحسوب ليس حكم قبول وفق أي كود ولا يعتبر تصميماً للقطاع.']);
  }
  case 'yemeni_land_units':{
   const factors={sanaa_labna:44.44,dhamar_labna:114.49,amran_labna:64,taiz_10_qasaba:20.25,hectare:10000,acre:4046.8564224};
   if(!Object.hasOwn(factors,v.unit))throw Error('Unsupported area unit');
   const area=n(v.areaM2,'areaM2',0,1e12);
   return output(kind,'تحويل مساحة الأراضي',{areaM2:area,unit:v.unit,value:round(area/factors[v.unit]),m2PerUnit:factors[v.unit]},['Number of units = area(m²) / (m² per unit)'],['قيم اللبنة والقصبة عرفية تقريبية؛ قد تختلف بحسب المنطقة ووثيقة الملكية.']);
  }
  default:throw Error('Unsupported advanced calculation');
 }
}
module.exports={specs,calculate};