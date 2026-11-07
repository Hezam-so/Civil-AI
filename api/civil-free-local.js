/* No-paid-model, deterministic on-server assistant fallback. */
'use strict';
const knowledge=require('./civil-knowledge.js');
const advanced=require('./civil-advanced.js');

const normalize=s=>String(s||'').replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/٫/g,'.').replace(/٬/g,'').toLowerCase().trim();
const numericLabel=(text,words)=>{
 for(const word of words){
  const key=word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const re=new RegExp('(?:'+key+')\\s*(?:[:=]|هو|قدرها|يساوي)?\\s*(\\d+(?:\\.\\d+)?)','i');
  const m=text.match(re);
  if(m){const val=Number(m[1]);if(Number.isFinite(val))return val;}
 }
 return null;
};
function routeAction(page){
 return {type:'navigate',target:'url',url:page.route,page:page.id,label:'فتح '+page.name,reason:'اطلاع المستخدم على قسم البرنامج'};
}
function fallback(question,reason='local'){
 const q=normalize(question),matches=knowledge.lookup(q);
 const overview=/^(?:ماهي|ما هي|ما|اشرح|عرفني|كيف يعمل|كيف استخدم|كيف أستخدم|الأدوات|الادوات|help|tools|features|what can)/.test(q);
 const askOpen=/(افتح|اذهب|انتقل|وديني|خذني|go to|open |navigate|show me)/i.test(q);
 const actions=[],calculations=[];
 if(askOpen&&matches.length){const page=matches.find(p=>p.id!=='home')||matches[0];actions.push(routeAction(page));}
 const isBeam=/كمرة|كمره|beam/.test(q);
 const isConcrete=/خرسانة|concrete/.test(q);
 // Only compute when the user labels all required quantities; no guessed geometry or load cases.
 try{
  if(isBeam&&/(موزع|udl|uniform)/.test(q)){
   const L=numericLabel(q,['طول البحر','البحر','طول الكمرة','span','length','l=','l ']);
   const w=numericLabel(q,['الحمل الموزع','شدة الحمل','الحمل المنتظم','udl','w=','w ']);
   if(L!==null&&w!==null)calculations.push(beamUDL(L,w));
  }else if(isConcrete){
   const area=numericLabel(q,['المساحة','مساحة','area']);
   const thick=numericLabel(q,['السماكة','سمك','سماكة','thickness','depth']);
   if(area!==null&&thick!==null)calculations.push(advanced.calculate('concrete_materials',{areaM2:area,thicknessM:thick}));
  }
 }catch(e){
  return {answer:'لم يكتمل الحساب بسبب مدخلات غير مقبولة: '+String(e.message).slice(0,160)+'\nتحقق من الأبعاد والوحدات ثم حاول مجددًا.',calculations:[],actions,mode:'local',reason};
 }
 if(calculations.length){
  const c=calculations[0];
  const lines=Object.entries(c.result||{}).slice(0,14).map(([k,v])=>k+': '+(typeof v==='number'?Number(v.toPrecision(7)):String(v))).join('\n');
  return {answer:'حساب هندسي باستخدام معادلات البرنامج، وليس تقديرًا من نموذج لغوي:\n'+lines+'\n\nالافتراضات: '+(c.assumptions||[]).join('؛ ')+'\nراجع بيانات التنفيذ والتصميم المعتمد.',calculations,actions,mode:'local',reason};
 }
 const candidates=matches.filter(p=>p.id!=='home').slice(0,4);
 if(askOpen&&actions.length){
  return {answer:'يمكنني إرشادك إلى القسم المطلوب. اضغط «موافق، افتح القسم»؛ لا يتم التنقل دون موافقتك.',actions,calculations,mode:'local',reason};
 }
 if(overview||/البرنامج|الموقع|civil ai|ماذا تستطيع|كيف/.test(q)){
  const txt=candidates.map(p=>'• '+p.name+': '+p.summary+'\nالحدود: '+p.limits).join('\n\n');
  return {answer:'دليل Civil AI المتاح دون رسوم نموذج لغوي:\n'+txt+'\n\nللمسائل الحسابية افتح الحاسبة الجانبية؛ وللانتقال إلى قسم قل «افتح» مع اسم الأداة. المحادثة الحرة المتقدمة تتطلب توفر النموذج المجاني.',actions,calculations,mode:'local',reason};
 }
 return {answer:'المساعد المحلي المجاني متاح لإرشادك داخل Civil AI ولحساب المسائل المدعومة بمعادلات ثابتة.\n'+
  'أستطيع مساعدتك في الخرسانة، الكمرات، التسليح، مساحة الأراضي، الخرائط والأدوات الهندسية.\n'+
  'إذا أردت حسابًا محددًا فاكتب المدخلات مع وحداتها، أو استخدم الحاسبة الجانبية. أما التحليل الهندسي الحر فيعتمد على توفر نموذج مجاني خارجي؛ لن أحوّل تلقائيًا إلى نموذج مدفوع.',actions,calculations,mode:'local',reason};
}
function beamUDL(L,w){
 if(!(L>0&&L<=500&&w>=0&&w<=1e6))throw Error('بحر الكمرة أو شدة الحمل خارج نطاق الأداة');
 const round=n=>Number(n.toPrecision(9));
 return {kind:'beam_udl',title:'ردود الأفعال والعزم والقص لكمرة بسيطة بحمل موزع',result:{spanM:L,loadKnPerM:w,reactionEachKn:round(w*L/2),maxShearKn:round(w*L/2),maxMomentKnM:round(w*L*L/8)},
 formulae:['R_A = R_B = wL/2','Vmax = wL/2','Mmax = wL²/8'],
 assumptions:['كمرة بسيطة الارتكاز وحمل موزع على كامل البحر','لا يشمل الترخيم أو التصميم الإنشائي أو معاملات الكود']};
}
module.exports={fallback,normalize,numericLabel};
