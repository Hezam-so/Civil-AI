/* Civil AI: deterministic engineering help when free cloud chat is unavailable. */
'use strict';
const knowledge=require('./civil-knowledge.js');
const advanced=require('./civil-advanced.js');
const norm=s=>String(s||'').normalize('NFKC').replace(/[٠-٩]/g,x=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(x))).replace(/[۰-۹]/g,x=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(x))).replace(/٫/g,'.').replace(/[إأآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').toLowerCase().trim();
const numbers=s=>(norm(s).match(/\d+(?:\.\d+)?/g)||[]).map(Number);
const round=x=>Number(Number(x).toPrecision(9));
function field(q,labels){
 for(const label of labels){
  const key=norm(label).replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&');
  const m=q.match(new RegExp(key+'\\s*(?:=|:|هو|قيمته|قدرها|ها)?\\s*(\\d+(?:\\.\\d+)?)'));
  if(m)return Number(m[1]);
 }
 return null;
}
const pages=knowledge.pages;
const byId=id=>pages.find(p=>p.id===id);
const acts=ids=>ids.map(byId).filter(Boolean).map(p=>({type:'navigate',target:'url',page:p.id,url:p.route,label:'فتح '+p.name})).slice(0,3);
const response=(answer,ids=[],calc=[],reason='local')=>({answer,actions:acts(ids),calculations:calc,mode:'local',reason});
const catalog={
 satellite:['قياس الأراضي على الخريطة','افتح «قياس الأراضي بالخريطة»، حدد موقع الأرض بالبحث أو الإحداثيات، قرّب الصورة، فعّل «إضافة الزوايا»، واضغط على أركان الأرض بالترتيب. تظهر المساحة والمحيط، ويمكن إدخال الشوارع المجاورة وتصدير DXF أو PDF.','القياس من الصور تقريبي وليس رفعًا مساحيًا قانونيًا.'],
 irregular:['مساحة الأرض غير المنتظمة','افتح «الأراضي غير المنتظمة»، اختر الإحداثيات X وY بالمتر أو طريقة المثلثات، أدخل بيانات الزوايا أو الأضلاع، ثم راجع الرسم والمساحة والمحيط واحفظ العمل.','لا تستخدم الإحداثيات الجغرافية الخام بدل الإحداثيات المستوية المترية.'],
 landarea:['تحويل وحدات الأراضي','افتح «تحويل وحدات الأراضي»، أدخل قيمة المساحة ثم وحدة البداية والنهاية (مثل متر مربع أو لبنة أو قصبة أو معاد)، واختر المنطقة المناسبة، ثم انسخ أو احفظ الناتج.','الوحدات العرفية المحلية تختلف؛ راجع سند الأرض.'],
 concrete:['حساب الخرسانة','افتح «حساب الخرسانة»، أدخل المساحة مباشرة أو الطول والعرض، ثم السماكة ونسبة الهدر وسعر الوحدة اختياريًا. يمكنك اختيار إضافات كيميائية أو معدنية أو ألياف وتحديد الجرعات، ثم احسب الأسمنت والرمل والحصى والماء والكميات الإجمالية.','هذه كميات تقديرية ولا تمثل خلطة إنشائية معتمدة.'],
 beam:['تحليل الكمرات','اختر «تحليل الكمرات»، أدخل طول البحر وحدد الحمل الموزع أو الحمل المركز في المنتصف، ثم احسب ردود الأفعال والقص والعزم. الأحمال المتعددة متاحة داخل المختبر المتقدم.','الكمرة البسيطة ليست تصميمًا إنشائيًا معتمدًا.'],
 rebar:['حصر حديد التسليح','افتح المختبر المتقدم ثم «حصر حديد التسليح»، أدخل قطر السيخ بالمليمتر وطوله بالمتر والعدد ونسبة الهدر، وأضف البنود واضغط «احسب»، ثم صدّر CSV عند الحاجة.','الحصر لا يحدد التسليح المطلوب إنشائيًا.'],
 footing:['الأساسات والتربة','من المختبر المتقدم افتح «الأساسات والتربة»، أدخل الحمل الخدمي وأبعاد القاعدة وسماكتها والضغط المسموح حسب تقرير التربة، ثم احسب الضغط المتوسط.','الفحص المبدئي لا يغني عن فحوص الهبوط والقص الثاقب واللامركزية.'],
 section:['خصائص القطاعات','في المختبر اختر «خصائص القطاعات»، ثم اختر مستطيلًا أو دائرة أو صندوقًا مجوفًا أو مقطع I، وأدخل الأبعاد بالملليمتر وعزم الانحناء عند الحاجة، ثم احسب المساحة والعطالة والإجهاد المرن.','لا يشمل فحوص الانبعاج أو اشتراطات الكود.'],
 earth:['كميات الحفر والردم','في المختبر اختر «الحفر والردم»، أدخل كل محطة ومساحة الحفر والردم بالمتر المربع، ثم احسب الأحجام بطريقة متوسط مساحتي النهايتين، ويمكن تصدير CSV.','لا يشمل عوامل الانتفاش أو الانكماش والنقل.'],
 units:['تحويل الوحدات','افتح «تحويل الوحدات»، حدد فئة الطول أو القوة أو الإجهاد، واختر الوحدتين والقيمة للحصول على نتيجة التحويل.','تأكد من صحة وحدات الإدخال.'],
 studio:['المختبر الهندسي المتقدم','افتح «المختبر الهندسي المتقدم» ثم اختر الكمرة أو القطاعات أو القواعد أو الحفر والردم أو حصر الحديد أو مكتبة الملفات. كل أداة تعرض وحداتها وفرضياتها.','الحسابات أولية وليست بديلًا عن مهندس مختص.'],
 projects:['المشاريع المحفوظة','استخدم الأداة التي تريدها واضغط «حفظ في مشاريعي» ثم افتح «مشاريعي» من الصفحة الرئيسية. مكتبة ملفات Studio المحلية لا تعني تزامن ملفاتك مع حسابك.','احتفظ بنسخ احتياطية من الملفات المهمة.'],
 upload:['إرفاق المخططات','افتح «إرفاق المخططات»، اختر AutoCAD أو Revit أو Civil 3D أو Robot، ثم استخدم العارض المناسب أو مكتبة الملفات لإضافة الملف من جهازك.','بعض العارضات تحتاج إعداد Autodesk APS؛ ورفع الملف لا يعني تحليله تلقائيًا.'],
 cad:['عارض ملفات DXF','افتح عارض CAD، اختر ملف DXF نصيًا من جهازك، ثم استخدم تكبير/تصغير وملاءمة الرسم وإظهار الطبقات. يمكن استخراج أطوال ومساحات لبعض الأشكال وتصدير CSV.','ملفات DWG لا تُفتح مباشرة في عارض DXF المحلي.'],
 model:['عارض النماذج الهندسية','افتح عارض النماذج، وتحقق من اتصال Autodesk APS، ثم ارفع صيغة مدعومة لعرض النموذج ثنائيًا أو ثلاثيًا عند توفر الخدمة.','قد يتطلب إعداد Autodesk ولم يتم ضمان دعم جميع الصيغ.'],
 robot:['عارض ملفات Robot','صدّر ملفات Nodes CSV وBars CSV من Robot، ثم افتح عارض Robot وحمّل ملفي العقد والقضبان، وبعدها اضغط «تحليل ملفات CSV».','الموقع لا يشغّل محرك تحليل Robot ولا يقرأ RTD مباشرة.'],
 assistant:['المساعد الهندسي','اكتب سؤالك بوضوح وحدد الوحدات والمقادير إن كان حسابيًا؛ يمكنك اختيار المساعد المحلي أو محاولة النموذج السحابي المجاني. اقترح الانتقال لأي أداة وسيظهر زر تأكيد قبل فتحها.','المساعد المحلي قواعد وحاسبات محددة، أما المحادثة الذكية الحرة فتعتمد على توفر النموذج السحابي.']
};
function topics(q){
 const ids=[];const add=id=>{if(!ids.includes(id))ids.push(id);};
 if(/قطعه|ارض|اراضي|ارضيه|parcel|plot|land/.test(q)){
  if(/خريط|قمر|فضائي|صور|satellite|map/.test(q))add('satellite');
  else if(/لبن|قصب|معاد|فدان|هكتار|وحد/.test(q))add('landarea');
  else if(/غير منتظم|احداثي|زوايا|مضلع|مثلث/.test(q))add('irregular');
  else{add('irregular');add('satellite');add('landarea');}
 }
 if(/خرسان|اسمنت|حصي|رمل|ملدن|concrete/.test(q))add('concrete');
 if(/كمرة|كمره|جسر|عزم|قص|beam|shear/.test(q))add('beam');
 if(/تسليح|حديد|سيخ|اسياخ|rebar/.test(q))add('rebar');
 if(/تربه|اساس|قاعده|قواعد|footing/.test(q))add('footing');
 if(/قطاع|مقطع|عطاله|inertia|section/.test(q))add('section');
 if(/حفر|ردم|earthwork/.test(q))add('earth');
 if(/وحدات|تحويل|convert/.test(q))add('units');
 if(/مشاريع|مشروعي|حفظ المشروع/.test(q))add('projects');
 if(/مخطط|رفع ملف|ارفاق|upload/.test(q))add('upload');
 if(/dxf|cad|اوتوكاد/.test(q))add('cad');
 if(/dwg|revit|bim|نموذج ثلاثي/.test(q))add('model');
 if(/robot|روبوت/.test(q))add('robot');
 if(/مختبر|studio/.test(q))add('studio');
 if(/مساعد|ذكاء|chatbot/.test(q))add('assistant');
 return ids;
}
function compute(q,ids){
 try{
 if(ids.includes('concrete')&&/احسب|كم|كميه|حجم|مساحه|volume/.test(q)){
  let a=field(q,['مساحه','area']),h=field(q,['سماكه','سمك','ارتفاع','thickness','depth']);
  const L=field(q,['طول','الطول','length']),W=field(q,['عرض','العرض','width']);
  if(a===null&&L!==null&&W!==null)a=L*W;
  const dims=q.match(/\d+(?:\.\d+)?\s*[×x*]\s*\d+(?:\.\d+)?\s*[×x*]\s*\d+(?:\.\d+)?/);
  if((a===null||h===null)&&dims){const v=dims[0].split(/[×x*]/).map(Number);a=v[0]*v[1];h=v[2];}
  if(a!==null&&h!==null){
   const r=advanced.calculate('concrete_materials',{areaM2:a,thicknessM:h,wastePercent:field(q,['هدر','الهدر'])??5});
   return response('حساب خرسانة لمساحة '+a+' م² وسماكة '+h+' م:\n'+Object.entries(r.result).map(([k,v])=>k+' = '+round(v)).join('\n')+'\n'+r.assumptions.join(' ؛ '),ids,[r]);
  }
  return response('لحساب الخرسانة أحتاج المساحة بالمتر المربع والسماكة بالمتر، أو الطول × العرض × السماكة. مثال: «احسب خرسانة مساحة 20 سماكة 0.2».',ids);
 }
 if(ids.includes('beam')&&/احسب|عزم|قص|رد فعل|كم|load|moment/.test(q)){
  const L=field(q,['طول البحر','البحر','طول','span','l']);
  const w=field(q,['الحمل الموزع','حمل موزع','شده الحمل','الحمل','w']);
  const p=field(q,['الحمل المركز','حمل مركز','p']);
  if(L!==null&&(w!==null||p!==null)){
   if(L<=0||L>500||(w??p)<0)throw Error('قيمة البحر أو الحمل غير مقبولة');
   const isP=/مركز|نقط|point/.test(q)&&p!==null;
   const value=isP?p:w,rea=value*(isP?0.5:L/2),moment=value*(isP?L/4:L*L/8);
   const r={title:'نتائج كمرة بسيطة',kind:'beam_basic',result:{spanM:L,reactionEachKn:round(rea),maxShearKn:round(rea),maxMomentKnM:round(moment)},formulae:isP?['R=P/2','M=PL/4']:['R=wL/2','M=wL²/8'],assumptions:['حمل مركز في المنتصف أو موزع على كامل البحر، وارتكاز بسيط']};
   return response('النتائج: رد الفعل عند كل مسند = '+round(rea)+' kN، أقصى قص = '+round(rea)+' kN، أقصى عزم = '+round(moment)+' kN·m. الفرض: كمرة بسيطة مع حمل '+(isP?'مركز في المنتصف.':'موزع على كامل البحر.'),ids,[r]);
  }
  return response('اذكر طول البحر بالمتر وقيمة الحمل بالكيلو نيوتن أو كيلو نيوتن/متر. مثال: «كمرة طول البحر 6 الحمل الموزع 10».',ids);
 }
 if(ids.includes('rebar')&&/احسب|كم|وزن|كميه/.test(q)){
  const d=field(q,['قطر','القطر']),L=field(q,['طول','طول السيخ']),n=field(q,['عدد','الكميه']);
  if(d!==null&&L!==null&&n!==null){
   const r=advanced.calculate('rebar_schedule',{diameterMm:d,barLengthM:L,quantity:n});
   return response('حصر الحديد:\n'+Object.entries(r.result).map(([k,v])=>k+' = '+round(v)).join('\n')+'\n'+r.assumptions.join(' ؛ '),ids,[r]);
  }
  return response('لحساب الحديد أدخل القطر بالمليمتر وطول السيخ بالمتر وعدد الأسياخ. مثال: «احسب حديد قطر 16 طول 6 عدد 20».',ids);
 }
 }catch(e){return response('تعذر الحساب بسبب قيمة غير صالحة: '+String(e.message).slice(0,140)+'؛ تأكد من الأبعاد ووحداتها.',ids);}
 return null;
}
function fallback(question,reason='local',history=[]){
 const raw=String(question||'').trim(),q=norm(raw);
 if(/^(مرحبا|اهلا|هلا|السلام عليكم|صباح الخير|مساء الخير|hello|hi|hey)[.!؟\s]*$/.test(q))
  return response('أهلًا بك في Civil AI! يمكنني شرح وظائف الموقع وحل مسائل هندسية مدعومة. اسأل مثلًا: «أين حساب قطعة أرض؟» أو «احسب خرسانة مساحة 20 سماكة 0.2» أو «كمرة طول البحر 6 الحمل الموزع 10».',[],[],reason);
 if(/من صاحب|من صمم|من طور|من مؤسس/.test(q))
  return response('طوّر المهندس حزام سليمان موقع Civil AI بوصفه منصة أدوات للهندسة المدنية وحساب الكميات والمساحات وعرض الملفات الهندسية.',[],[],reason);
 let ids=topics(q);
 if(!ids.length&&Array.isArray(history)&&/كيف|طيب|اين|وماذا|ثم|كم/.test(q)){
  const prev=history.slice().reverse().find(x=>x?.role==='user'&&typeof x.content==='string');
  if(prev)ids=topics(norm(prev.content));
 }
 const wantsDirection=/اين|وين|كيف اصل|مكان|افتح|اذهب|انتقل|وديني|اريد|ابي|open|navigate|show me/.test(q);
 const wantsInstructions=/كيف|طريقه|شرح|استخدم|خطوات|explain|help/.test(q);
 if(ids.length){
  if(!wantsDirection&&(!wantsInstructions||numbers(q).length>0)){const result=compute(q,ids);if(result)return {...result,reason};}
  if(ids.includes('irregular')&&ids.includes('satellite')){
   return response('لحساب مساحة قطعة الأرض لديك ثلاث طرق:\n1. «الأراضي غير المنتظمة» إذا كان لديك إحداثيات الزوايا أو أضلاع المثلثات.\n2. «قياس الأراضي بالخريطة» إذا أردت تحديد الزوايا على صورة جوية وتصدير DXF/PDF.\n3. «تحويل وحدات الأراضي» لتحويل المساحة من متر مربع إلى لبنة أو قصبة وغيرها.\nاختر القسم المناسب من الأزرار المقترحة أدناه.', ['irregular','satellite','landarea'],[],reason);
  }
  const d=catalog[ids[0]];
  if(d)return response(d[0]+'\n'+d[1]+'\n\nتنبيه: '+d[2],ids,[],reason);
 }
 if(/البرنامج|الموقع|الخدمات|الادوات|civil ai/.test(q))
  return response('يضم Civil AI: مساعدًا هندسيًا، وحاسبة خرسانة ومكوناتها، وحاسبة كمرات، وقياس أراضٍ بالأقمار الصناعية، وحساب أرض غير منتظمة وتحويل وحداتها، ومختبرًا للقطاعات والأساسات وحصر التسليح والحفر والردم، وعارضات للملفات وحفظ المشاريع. أخبرني باسم القسم لشرح خطواته.', ['assistant','studio','satellite'],[],reason);
 if(/حاسبه|حسابات|احسب|calculator/.test(q)&&!ids.length)
  return response('توجد حاسبات مباشرة في الصفحة الرئيسية للخرسانة والكمرات وتحويل الوحدات، وفي المختبر المتقدم للقواعد والقطاعات والتسليح والحفر والردم، وكذلك حاسبة الأراضي. أخبرني بنوع الحساب الذي تريده لأفتح الصفحة المناسبة.', ['concrete','beam','studio'],[],reason);
 if(/شكرا|ممتاز|تسلم/.test(q))return response('على الرحب والسعة! اكتب سؤالك الهندسي مع الأبعاد والوحدات، وسأوجهك للأداة المناسبة.',[],[],reason);
 return response('سؤالك: «'+raw.slice(0,160)+'».\nلا أستطيع حاليًا تحليل جميع الأسئلة الحرة لأن النموذج السحابي لم يقبل الاتصال. بدل تكرار رد عام، يمكنك سؤالي عن أداة محددة أو إدخال أبعاد المسألة مع وحداتها. مثال: «أين حساب قطعة أرض؟»، «كيف أحسب حديد التسليح؟»، «احسب خرسانة مساحة 20 سماكة 0.2».',[],[],reason);
}
module.exports={fallback,normalize:norm,field,topics};
