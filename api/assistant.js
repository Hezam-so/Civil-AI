'use strict';
/**
 * Civil AI engineering copilot. Numerical tools are deterministic and validated.
 * Model-generated UI actions are proposals only and need user confirmation.
 */
const crypto=require('node:crypto');
const {get}=require('@vercel/blob');
const knowledge=require('./civil-knowledge');
const advanced=require('./civil-advanced');
const localAssistant=require('./civil-free-local');
const externalModels=require('./civil-model-providers');
const FREE_MODELS=new Set(['inclusionai/ling-3.0-tiny-free']);
const MODEL=FREE_MODELS.has(process.env.CIVIL_AI_AI_MODEL)?process.env.CIVIL_AI_AI_MODEL:'inclusionai/ling-3.0-tiny-free'; // Verified free text/tool model; no paid model routing.
const ttl=14*86400;
const respond=(res,status,data)=>res.status(status).json(data);
const num=(v,label,{min=0,max=1e9,zero=true}={})=>{
 if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||(!zero&&v===0))
   throw Error('قيمة '+label+' غير صالحة. تحقق من المدخلات والوحدات.');
 return v;
};
const round=(v)=>Number(v.toPrecision(9));
const calc=(kind,v={})=>{
 let x={};
 switch(kind){
 case 'beam_udl':{
  const L=num(v.spanM,'L (m)',{min:.01,max:500});
  const w=num(v.loadKnPerM,'w (kN/m)',{max:1e6});
  x={support:'simple',spanM:L,loadKnPerM:w,reactionEachKn:round(w*L/2),maxShearKn:round(w*L/2),maxMomentKnM:round(w*L*L/8)};
  return {kind,title:'كمرة بسيطة الارتكاز تحت حمل موزع منتظم',result:x,formulae:['R_A = R_B = w×L/2','|V|max = w×L/2','Mmax = w×L²/8'],assumptions:['طرفان بسيطا الارتكاز، حمل رأسي موزع على كامل البحر','النتيجة أولية ولا تشمل فحص المقاومة أو الترخيم أو معاملات الكود']};
 }
 case 'beam_point':{
  const L=num(v.spanM,'L (m)',{min:.01,max:500});
  const P=num(v.loadKn,'P (kN)',{max:1e7});
  x={support:'simple',spanM:L,centralLoadKn:P,reactionEachKn:round(P/2),maxShearKn:round(P/2),maxMomentKnM:round(P*L/4)};
  return {kind,title:'كمرة بسيطة الارتكاز تحت حمل مركز في منتصفها',result:x,formulae:['R_A = R_B = P/2','|V|max = P/2','Mmax = P×L/4'],assumptions:['الحمل في منتصف البحر والطرفان بسيطا الارتكاز','لا يشمل فحص مقاومة القطاع أو الترخيم أو الأحمال الأخرى']};
 }
 case 'concrete_volume':{
  const L=num(v.lengthM,'الطول (m)',{min:.001,max:10000});
  const W=num(v.widthM,'العرض (m)',{min:.001,max:10000});
  const H=num(v.heightM,'السماكة/الارتفاع (m)',{min:.001,max:1000});
  const waste=num(v.wastePercent??0,'نسبة الهدر (%)',{max:100});
  const gross=L*W*H*(1+waste/100);
  x={lengthM:L,widthM:W,heightM:H,wastePercent:waste,netVolumeM3:round(L*W*H),grossVolumeM3:round(gross)};
  if(v.unitCost!==undefined){const c=num(v.unitCost,'تكلفة المتر المكعب',{max:1e12});x.unitCost=c;x.estimatedCost=round(gross*c)}
  return {kind,title:'حساب حجم الخرسانة لعنصر مستطيل',result:x,formulae:['Vالصافي = الطول × العرض × الارتفاع','Vمع الهدر = Vالصافي × (1 + الهدر/100)'],assumptions:['كل الأبعاد بالمتر وقطاع العنصر مستطيل منتظم','الكمية تقديرية ولا تشمل الفتحات أو طريقة التنفيذ إلا إذا أدخلت ضمن الأبعاد']};
 }
 case 'footing_pressure':{
  const P=num(v.axialLoadKn,'الحمل المحوري (kN)',{max:1e9});
  const L=num(v.lengthM,'الطول (m)',{min:.001,max:10000});
  const B=num(v.widthM,'العرض (m)',{min:.001,max:10000});
  const q=P/(L*B);
  x={axialLoadKn:P,areaM2:round(L*B),averageContactPressureKpa:round(q)};
  if(v.allowableKpa!==undefined){const qa=num(v.allowableKpa,'الضغط المسموح (kPa)',{min:.001,max:1e9});x.allowableKpa=qa;x.pressureRatio=round(q/qa);x.withinProvidedAllowable=q<=qa}
  return {kind,title:'الضغط المتوسط أسفل قاعدة سطحية',result:x,formulae:['q_avg = P / (L × B) [kPa]'],assumptions:['حمل رأسي مركزي فقط دون عزوم أو لامركزية','لا يشمل وزن القاعدة ما لم يضف إلى P؛ لا يقيّم الهبوط أو الانقلاب أو القص الثاقب']};
 }
 case 'rebar_weight':{
  const diameterMm=num(v.diameterMm,'قطر السيخ (mm)',{min:3,max:100});
  const totalLengthM=num(v.totalLengthM,'مجموع الأطوال (m)',{min:0,max:1e9});
  const rho=7850,kgPerM=(Math.PI/4)*Math.pow(diameterMm/1000,2)*rho;
  return {kind,title:'الوزن النظري لحديد التسليح',result:{diameterMm,totalLengthM,kgPerM:round(kgPerM),totalWeightKg:round(kgPerM*totalLengthM)},formulae:['m = (π/4) × (d/1000)² × 7850 × L [kg]'],assumptions:['كثافة فولاذ افتراضية 7850 kg/m³','لا يشمل وصلات التراكب أو الهدر أو تفاوت التصنيع']};
 }
 case 'rect_section':{
  const b=num(v.widthMm,'عرض القطاع (mm)',{min:.001,max:100000});
  const h=num(v.heightMm,'ارتفاع القطاع (mm)',{min:.001,max:100000});
  return {kind,title:'خصائص قطاع مستطيل مصمت',result:{widthMm:b,heightMm:h,areaMm2:round(b*h),IxMm4:round(b*Math.pow(h,3)/12),ZxMm3:round(b*h*h/6)},formulae:['A = b×h','I_x = b×h³/12','Z_x = b×h²/6'],assumptions:['قطاع مستطيل مصمت والمحور يمر بمركز القطاع','خصائص هندسية فقط وليست فحصًا لقدرة التحمل']};
 }
 case 'convert_units':{
  const units={
   length:{m:1,cm:.01,mm:.001,km:1000,ft:.3048,in:.0254},
   force:{N:1,kN:1000,lbf:4.4482216153,kip:4448.2216153},
   pressure:{Pa:1,kPa:1000,MPa:1e6,GPa:1e9,psi:6894.7572932,ksi:6894757.2932},
   area:{m2:1,cm2:1e-4,mm2:1e-6,ft2:.09290304}
  };
  const category=String(v.category||''),from=String(v.from||''),to=String(v.to||'');
  if(!Object.hasOwn(units,category)||!Object.hasOwn(units[category],from)||!Object.hasOwn(units[category],to))throw Error('وحدات التحويل غير مدعومة.');
  const value=num(v.value,'قيمة التحويل',{min:-1e12,max:1e12});
  return {kind,title:'تحويل وحدات',result:{category,from,to,input:value,output:round(value*units[category][from]/units[category][to])},formulae:['القيمة × معامل الوحدة الأصلية ÷ معامل الوحدة المطلوبة'],assumptions:['تطابق فئة الأبعاد بين الوحدتين']};
 }
 default:throw Error('نوع المسألة غير مدعوم. اختر أداة من القائمة.');
 }
};
const basicSpecs={
 beam_udl:{description:'Calculate simply supported beam under full-span uniform distributed load (UDL). Inputs L in meters and w in kN/m; exact deterministic formulas.',properties:{spanM:{type:'number'},loadKnPerM:{type:'number'}},required:['spanM','loadKnPerM']},
 beam_point:{description:'Simply supported beam with a single vertical point load exactly at midspan, L meters P kN.',properties:{spanM:{type:'number'},loadKn:{type:'number'}},required:['spanM','loadKn']},
 concrete_volume:{description:'Concrete volume of a rectangular prism. All dimensions meters, optional waste percentage and cost per cubic meter.',properties:{lengthM:{type:'number'},widthM:{type:'number'},heightM:{type:'number'},wastePercent:{type:'number'},unitCost:{type:'number'}},required:['lengthM','widthM','heightM']},
 footing_pressure:{description:'AVERAGE ground contact pressure for a concentric vertical load only, no bending eccentricity, settlement or code verification.',properties:{axialLoadKn:{type:'number'},lengthM:{type:'number'},widthM:{type:'number'},allowableKpa:{type:'number'}},required:['axialLoadKn','lengthM','widthM']},
 rebar_weight:{description:'Theoretical mass of straight reinforcement given diameter in mm and sum of lengths in m.',properties:{diameterMm:{type:'number'},totalLengthM:{type:'number'}},required:['diameterMm','totalLengthM']},
 rect_section:{description:'Area and second moment Ix / elastic section modulus Zx of a solid rectangular cross-section, mm dimensions.',properties:{widthMm:{type:'number'},heightMm:{type:'number'}},required:['widthMm','heightMm']},
 convert_units:{description:'Convert engineering length, force, pressure, area units, only specified categories.',properties:{category:{type:'string',enum:['length','force','pressure','area']},from:{type:'string'},to:{type:'string'},value:{type:'number'}},required:['category','from','to','value']},
 open_tool:{description:'Propose navigation to a section of Civil AI. Does not execute; user must approve.',properties:{target:{type:'string',enum:['main','studio']},page:{type:'string'},reason:{type:'string'}},required:['target','page']},
 prepare_main_form:{description:'Propose (not execute) filling homepage beam or concrete calculator fields after explicit user request. User must approve in UI.',properties:{page:{type:'string',enum:['beam','concrete']},spanM:{type:'number'},loadType:{type:'string',enum:['udl','point']},loadValue:{type:'number'},lengthM:{type:'number'},widthM:{type:'number'},heightM:{type:'number'},wastePercent:{type:'number'},unitCost:{type:'number'},areaM2:{type:'number'}},required:['page']}
};
const specs={...basicSpecs,...advanced.specs,
 open_page:{description:'Suggest opening one of the verified Civil AI pages with user approval.',properties:{pageId:{type:'string',enum:knowledge.pages.map(p=>p.id)}},required:['pageId']},
 prepare_studio_form:{description:'Suggest prefill of supported Studio beam, footing and section fields after explicit user confirmation; never executes or saves.',properties:{page:{type:'string',enum:['beam','footing','section','rebar','earth']},diameterMm:{type:'number'},barLengthM:{type:'number'},quantity:{type:'number'},wastePercent:{type:'number'},stationRows:{type:'string'},spanM:{type:'number'},elasticModulusGpa:{type:'number'},inertiaMm4:{type:'number'},axialLoadKn:{type:'number'},lengthM:{type:'number'},widthM:{type:'number'},heightM:{type:'number'},allowableKpa:{type:'number'},sectionWidthMm:{type:'number'},sectionHeightMm:{type:'number'}},required:['page']}
};
const tools=Object.entries(specs).map(([name,v])=>({type:'function',function:{name,description:v.description,parameters:{type:'object',properties:v.properties,required:v.required,additionalProperties:false}}}));
const pageAllowed={
 main:new Set(['home','beam','concrete','units','projects','assistant']),
 studio:new Set(['home','beam','section','footing','earth','rebar','files','assistant'])
};
function act(name,args){
 if(name==='open_page'){
  const page=knowledge.pages.find(p=>p.id===args.pageId);
  if(!page||!knowledge.allowedRoutes.has(page.route))throw Error('Unknown site page');
  return {type:'navigate',target:'url',page:page.id,url:page.route,label:page.name,reason:page.summary};
 }
 if(name==='prepare_studio_form'){
  const page=String(args.page),fields={},mapping={
   beam:[['beamL','spanM',.1,200],['beamE','elasticModulusGpa',.001,1000],['beamI','inertiaMm4',1,1e18]],
   footing:[['footP','axialLoadKn',0,1e9],['footL','lengthM',.001,10000],['footB','widthM',.001,10000],['footH','heightM',0,10000],['footQ','allowableKpa',.001,1e9]],
   section:[['secB','sectionWidthMm',.001,100000],['secH','sectionHeightMm',.001,100000]],
   rebar:[['barDia','diameterMm',1,100],['barLen','barLengthM',.001,1000],['barQty','quantity',1,100000],['barWaste','wastePercent',0,100]],
   earth:[]
  };
  if(!Object.hasOwn(mapping,page))throw Error('Studio page unsupported.');
  for(const [input,key,min,max] of mapping[page])if(args[key]!==undefined)fields[input]=num(args[key],key,{min,max});
  if(page==='earth'&&args.stationRows!==undefined){const v=String(args.stationRows||'').trim();if(v.length>1500||!/^\d+(?:\.\d+)?\s*,\s*\d+(?:\.\d+)?\s*,\s*\d+(?:\.\d+)?(?:\s*\n\s*\d+(?:\.\d+)?\s*,\s*\d+(?:\.\d+)?\s*,\s*\d+(?:\.\d+)?)*$/.test(v))throw Error('صيغة المحطات غير صحيحة؛ استخدم: المحطة, الحفر, الردم في كل سطر.');fields.stations=v;}
  if(!Object.keys(fields).length)throw Error('No Studio form values provided.');
  return {type:'prefill',target:'studio',page,fields,label:'تعبئة '+page};
 }
 if(name==='open_tool'){
  const target=String(args.target),page=String(args.page);
  if(!pageAllowed[target]?.has(page))throw Error('هذه الصفحة غير متاحة.');
  return {type:'navigate',target,page,label:'فتح '+page,reason:String(args.reason||'').slice(0,150)};
 }
 if(name==='prepare_main_form'){
  const page=String(args.page),fields={};
  if(page==='beam'){
   if(args.spanM!==undefined)fields.span=num(args.spanM,'البحر (m)',{min:.01,max:500});
   if(args.loadType!==undefined){if(!['udl','point'].includes(args.loadType))throw Error('نوع الحمل غير مدعوم');fields.loadType=args.loadType}
   if(args.loadValue!==undefined)fields.load=num(args.loadValue,'قيمة الحمل',{max:1e6});
  }else if(page==='concrete'){
   if(args.areaM2!==undefined){fields.cAreaMode='direct';fields.cArea=num(args.areaM2,'مساحة الخرسانة (م²)',{min:.001,max:1e10})}
   for(const [input,key,min,max] of [['cLength','lengthM',.001,10000],['cWidth','widthM',.001,10000],['cDepth','heightM',.001,1000],['cWaste','wastePercent',0,100],['cCost','unitCost',0,1e12]])if(args[key]!==undefined)fields[input]=num(args[key],key,{min,max});
  }else throw Error('نوع النموذج غير مدعوم.');
  if(Object.keys(fields).length===0)throw Error('لم تُحدد قيم لتعبئتها.');
  return {type:'prefill',target:'main',page,fields,label:'تعبئة نموذج '+(page==='beam'?'الكمرة':'الخرسانة')};
 }
 throw Error('الأمر غير مصرح به.');
}
function parseCookie(req){
 try{
  const raw=String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('civilai_user_session='));
  if(!raw)return null;
  const parts=raw.slice('civilai_user_session='.length).split('.');
  if(parts.length!==4)return null;
  const [id,expiry,version,mac]=parts;
  if(!/^[a-f0-9]{64}$/.test(id)||!/^\d{10}$/.test(expiry)||! /^[a-f0-9]{32}$/.test(version))return null;
  const now=Math.floor(Date.now()/1000);
  if(Number(expiry)<now||Number(expiry)>now+ttl+90)return null;
  const v=id+'.'+expiry+'.'+version;
  const expected=crypto.createHmac('sha256',process.env.CIVIL_AI_AUTH_SECRET).update(v).digest('base64url');
  const a=Buffer.from(expected),b=Buffer.from(mac);
  return a.length===b.length&&crypto.timingSafeEqual(a,b)?{id,version}:null;
 }catch{return null}
}
async function userFor(req){
 const s=parseCookie(req);
 if(!s)return null;
 const doc=await get('civilai/users/'+s.id+'.json',{access:'private'});
 if(!doc?.stream)return null;
 const u=JSON.parse(await new Response(doc.stream).text());
 return u.sessionVersion===s.version?u:null;
}
const secureOrigin=req=>req.headers.origin==='https://'+(req.headers['x-forwarded-host']||req.headers.host);
const gatewayToken=req=>process.env.AI_GATEWAY_API_KEY||req?.headers?.['x-vercel-oidc-token']||process.env.VERCEL_OIDC_TOKEN;
const authReady=req=>!!gatewayToken(req);
function extractNavigation(question){
 if(!/(افتح|انتقل|اذهب|اذهبي|روح|وديني|اعرض|open|navigate|go to|show me)/i.test(question))return [];
 const options=[
  [/ملفات|مخططات|dwg|revit|رفع|ifc|upload|file/i,'studio','files'],
  [/حديد|تسليح|rebar/i,'studio','rebar'],
  [/تربة|اساس|أساس|قواعد|footing/i,'studio','footing'],
  [/الحفر|ردم|earth/i,'studio','earth'],
  [/مقطع|قطاع|section/i,'studio','section'],
  [/خرسان|concrete/i,'main','concrete'],
  [/كمرة|كمره|beam/i,'main','beam'],
  [/وحدات|تحويل|units/i,'main','units'],
  [/مشاريع|projects/i,'main','projects']
 ];
 for(const [re,target,page] of options)if(re.test(question))return [{type:'navigate',target,page,label:'فتح '+page}];
 return [];
}
function offlineAnswer(question,reason,history){return localAssistant.fallback(question,reason,history)}
async function askModel(messages,req){
 return externalModels.completion(messages,tools,req);
}
module.exports=async function(req,res){
 res.setHeader('Cache-Control','private,no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method==='GET'){const status=externalModels.status(req);return respond(res,200,{enabled:status.available,cloudConfigured:status.available,cloudVerified:status.providerVerified,provider:status.configuredProvider,providerMessage:status.message,openrouterConfigured:status.openrouterConfigured,model:status.model,calculators:true,localFree:true,freeCloudSubjectToAvailability:true,actionsRequireConfirmation:true,dailyAILimit:null});}
 if(req.method!=='POST')return respond(res,405,{error:'Method not allowed'});
 if(!secureOrigin(req))return respond(res,403,{error:'يجب إرسال الطلب من الموقع الأصلي.'});
 if(Number(req.headers['content-length']||0)>4200000)return respond(res,413,{error:'حجم الطلب كبير جدًا.'});
 try{
  if(!process.env.BLOB_READ_WRITE_TOKEN||!process.env.CIVIL_AI_AUTH_SECRET)return respond(res,503,{error:'خدمة الحسابات غير مهيأة.'});
  const user=await userFor(req);
  if(!user)return respond(res,401,{error:'سجل دخولك إلى حسابك أولًا.'});
  const input=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
  if(input.operation==='calculate'){
   try{return respond(res,200,{answer:'تم الحساب بمعادلات ثابتة، مع عرض الفرضيات والوحدات.',calculations:[Object.hasOwn(advanced.specs,input.calculation?.kind)?advanced.calculate(input.calculation.kind,input.calculation?.values):calc(input.calculation?.kind,input.calculation?.values)],actions:[],mode:'calculator'})}
   catch(e){return respond(res,400,{error:e.message})}
  }
  if(input.operation!=='chat')return respond(res,400,{error:'نوع العملية غير مدعوم.'});
  const question=String(input.question||'').trim();
  if(question.length<2||question.length>4000)return respond(res,400,{error:'أدخل سؤالًا من 2 إلى 4000 حرف.'});
  const image=String(input.attachmentDataUrl||'');
  if(image&&(!/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=\s]+$/i.test(image)||image.length>3900000))
   return respond(res,415,{error:'المرفقات المدعومة حاليًا: صورة PNG أو JPEG أو WebP لا تتجاوز 2.8 MB. لا ترفع PDF هنا.'});
  if(input.aiMode==='local')return respond(res,200,offlineAnswer(question,'local-selected',input.history));
  if(!externalModels.preferred(req))return respond(res,200,offlineAnswer(question,'cloud-not-configured',input.history));
  // External provider uses explicitly free models only; never selects a paid fallback.
  const history=Array.isArray(input.history)?input.history.slice(-10).filter(m=>['user','assistant'].includes(m.role)&&typeof m.content==='string').map(m=>({role:m.role,content:m.content.slice(0,2500)})):[];
  const guide=knowledge.pages.map(p=>p.name+' @ '+p.route+' — '+p.summary).join('\n');
  const related=knowledge.lookup(question).map(p=>p.name+': '+p.summary+' ؛ حدود: '+p.limits).join('\n');
  const system=[
   'أنت مساعد Civil AI للهندسة المدنية. أجب بلغة المستخدم العربية أو الإنجليزية بدقة ووضوح. المعرفة بالبرنامج من الدليل المرفق لا من التخمين.',
   'عند حل مسألة رقمية مدعومة استدع أداة الحساب أولاً ثم اشرح النتائج والمعادلات والوحدات والافتراضات والقيود. لا تخترع مدخلات ناقصة أو حدود أكواد؛ اسأل عند الحاجة.',
   'استخدم program_help لفهم ميزات Civil AI، وopen_page لاقتراح فتح أي صفحة مدعومة، وprepare_main_form لتعبئة حاسبات الصفحة الرئيسية وprepare_studio_form لتعبئة الكمرات والقطاعات والقواعد وحديد التسليح والحفر والردم. كل أفعال التحكم تحتاج تأكيد المستخدم، ولا تحفظ أو تحذف أو تغير المشاريع من تلقاء نفسك. استخدم أدوات الحساب المعتمدة للمسائل المدعومة، وقدم تعبئة الحاسبة كإجراء مقترح فقط.',
   'لا تدعِ القيام بتحليل FEM أو تنفيذ Robot أو قراءة ملف DWG إن لم تنفذ أدوات موثوقة. عند وصول صورة يمكنك وصف الظاهر فقط دون اختلاق أبعاد أو قراءات غير واضحة. تصميم الخلطة الخرسانية وكود البناء يحتاجان مراجعة مهندس. لا تختلق مصادر.',
   'إن كانت المسألة خارج نطاق الحاسبات الرقمية فقدم منهج الحل وتحقق من الأبعاد ومعلومات التصميم، ولا تدع الفحص المبدئي فحصاً معتمداً.',
   'النموذج الخارجي يختار نموذجاً مجانياً فقط دون تحويل إلى نموذج مدفوع احتياطياً. الإجابات الحرة قد تكون غير دقيقة؛ استخدم الأدوات الحسابية للنتائج المدعومة.',
   'صفحات الموقع: '+guide,
   'الصفحات المتصلة بالسؤال والحدود: '+related
  ].join('\n');
  // Vision is only offered through OpenRouter's free router when explicitly configured.
  // Uploaded images never go to the local fallback for automatic analysis.
  if(image&&externalModels.preferred(req)!=='openrouter'){
    const local=offlineAnswer(question,'image-provider-not-configured',history);
    local.answer='لا تتوفر معالجة الصور دون ربط مزوّد OpenRouter خارجي؛ لم تُفحص الصورة.\n'+local.answer;
    return respond(res,200,local);
  }
  const content=image?[{type:'text',text:question},{type:'image_url',image_url:{url:image,detail:'low'}}]:question;
  const messages=[{role:'system',content:system},...history,{role:'user',content}];
  const calculations=[],actions=[];
  let answer='';
  try{
  for(let turn=0;turn<4;turn++){
   const completion=await askModel(messages,req);
   const reply=completion.message;
   if(Array.isArray(reply.tool_calls)&&reply.tool_calls.length){
    const calls=reply.tool_calls.slice(0,8);
    messages.push({role:'assistant',content:reply.content||null,tool_calls:calls});
    for(const call of calls){
     let result;
     try{
      const args=JSON.parse(call.function?.arguments||'{}'),name=String(call.function?.name||'');
      if(['open_tool','prepare_main_form','open_page','prepare_studio_form'].includes(name)){
       result=act(name,args);if(actions.length<6)actions.push(result);
      }else if(Object.hasOwn(advanced.specs,name)){
       result=advanced.calculate(name,args);if(calculations.length<6)calculations.push(result);
      }else if(Object.hasOwn(basicSpecs,name)){
       result=calc(name,args);if(calculations.length<6)calculations.push(result);
      }else result={error:'أداة غير متاحة.'};
     }catch(e){result={error:String(e.message).slice(0,180)}}
     messages.push({role:'tool',tool_call_id:call.id,content:JSON.stringify(result)});
    }
   }else {answer=typeof reply.content==='string'?reply.content.trim():'';break}
  }
  }catch(e){
   console.warn('Civil AI external model unavailable; local fallback used:',String(e?.provider||'none'),Number(e?.providerStatus||0));
   const safe=offlineAnswer(question,'cloud-unavailable',history);safe.cloudUnavailable=true;safe.cloudProvider=e.provider||externalModels.preferred(req);safe.gatewayIssue=e.providerStatus===403?'access-denied':e.providerStatus===429?'rate-limited':e.providerStatus===402?'credits':e.providerStatus===401?'authentication':'unavailable';
   if(image)safe.answer='تعذر تحليل الصورة بالمزوّد الخارجي؛ لم أتمكن من فحصها.\n'+safe.answer;
   return respond(res,200,safe);
  }
  if(!answer&&calculations.length)answer='هذه نتائج الأدوات الحسابية. تأكد من الفروض والوحدات قبل استخدامها في التصميم.';
  if(!answer&&actions.length)answer='اقتراحات للتحكم في Civil AI؛ اضغط على الزر للتأكيد قبل تطبيقها.';
  if(!answer)answer='لم أتمكن من إكمال الرد. جرّب سؤالًا أكثر تحديدًا.';
  return respond(res,200,{answer:answer.slice(0,9000),calculations,actions,mode:'ai',model:externalModels.status(req).model,provider:externalModels.preferred(req)});
 }catch(e){
  console.error('Civil AI assistant error:',String(e.name||'Error'));
  return respond(res,e.status||500,{error:e.status?e.message:'تعذر تشغيل المساعد الآن. تحقق من اتصال AI Gateway أو جرّب الحاسبة الهندسية.'});
 }
};