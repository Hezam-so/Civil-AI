'use strict';
/**
 * Civil AI engineering copilot. Numerical tools are deterministic and validated.
 * Model-generated UI actions are proposals only and need user confirmation.
 */
const crypto=require('node:crypto');
const {get}=require('@vercel/blob');
const MODEL=process.env.CIVIL_AI_AI_MODEL||'openai/gpt-5.4-mini';
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
const specs={
 beam_udl:{description:'Calculate simply supported beam under full-span uniform distributed load (UDL). Inputs L in meters and w in kN/m; exact deterministic formulas.',properties:{spanM:{type:'number'},loadKnPerM:{type:'number'}},required:['spanM','loadKnPerM']},
 beam_point:{description:'Simply supported beam with a single vertical point load exactly at midspan, L meters P kN.',properties:{spanM:{type:'number'},loadKn:{type:'number'}},required:['spanM','loadKn']},
 concrete_volume:{description:'Concrete volume of a rectangular prism. All dimensions meters, optional waste percentage and cost per cubic meter.',properties:{lengthM:{type:'number'},widthM:{type:'number'},heightM:{type:'number'},wastePercent:{type:'number'},unitCost:{type:'number'}},required:['lengthM','widthM','heightM']},
 footing_pressure:{description:'AVERAGE ground contact pressure for a concentric vertical load only, no bending eccentricity, settlement or code verification.',properties:{axialLoadKn:{type:'number'},lengthM:{type:'number'},widthM:{type:'number'},allowableKpa:{type:'number'}},required:['axialLoadKn','lengthM','widthM']},
 rebar_weight:{description:'Theoretical mass of straight reinforcement given diameter in mm and sum of lengths in m.',properties:{diameterMm:{type:'number'},totalLengthM:{type:'number'}},required:['diameterMm','totalLengthM']},
 rect_section:{description:'Area and second moment Ix / elastic section modulus Zx of a solid rectangular cross-section, mm dimensions.',properties:{widthMm:{type:'number'},heightMm:{type:'number'}},required:['widthMm','heightMm']},
 convert_units:{description:'Convert engineering length, force, pressure, area units, only specified categories.',properties:{category:{type:'string',enum:['length','force','pressure','area']},from:{type:'string'},to:{type:'string'},value:{type:'number'}},required:['category','from','to','value']},
 open_tool:{description:'Propose navigation to a section of Civil AI. Does not execute; user must approve.',properties:{target:{type:'string',enum:['main','studio']},page:{type:'string'},reason:{type:'string'}},required:['target','page']},
 prepare_main_form:{description:'Propose (not execute) filling homepage beam or concrete calculator fields after explicit user request. User must approve in UI.',properties:{page:{type:'string',enum:['beam','concrete']},spanM:{type:'number'},loadType:{type:'string',enum:['udl','point']},loadValue:{type:'number'},lengthM:{type:'number'},widthM:{type:'number'},heightM:{type:'number'},wastePercent:{type:'number'},unitCost:{type:'number'}},required:['page']}
};
const tools=Object.entries(specs).map(([name,v])=>({type:'function',function:{name,description:v.description,parameters:{type:'object',properties:v.properties,required:v.required,additionalProperties:false}}}));
const pageAllowed={
 main:new Set(['home','beam','concrete','units','projects','assistant']),
 studio:new Set(['home','beam','section','footing','earth','rebar','files','assistant'])
};
function act(name,args){
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
const authReady=()=>!!(process.env.AI_GATEWAY_API_KEY||process.env.VERCEL_OIDC_TOKEN);
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
function offlineAnswer(question){
 const moves=extractNavigation(question);
 const msg=moves.length?'يمكنني فتح القسم المطلوب بعد موافقتك.':'يمكنني تنفيذ حسابات دقيقة بالأدوات المضمنة مثل ردود الأفعال والعزم للكمرة البسيطة، حجم الخرسانة، ضغط القاعدة المبدئي، حديد التسليح، خصائص القطاع وتحويل الوحدات.';
 return {answer:msg+' لكن التحليل اللغوي الحر يحتاج تفعيل اتصال نموذج الذكاء الاصطناعي عبر Vercel AI Gateway. استخدم زر «حاسبة هندسية» لإدخال أرقام المسألة بصورة منظمة، أو اختر أداة الحساب.',actions:moves,calculations:[],mode:'tools-only'};
}
async function askModel(messages){
 const token=process.env.AI_GATEWAY_API_KEY||process.env.VERCEL_OIDC_TOKEN;
 const response=await fetch('https://ai-gateway.vercel.sh/v1/chat/completions',{
  method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  signal:AbortSignal.timeout(25000),
  body:JSON.stringify({model:MODEL,messages,tools,tool_choice:'auto',max_completion_tokens:2400})
 });
 if(!response.ok){
  console.error('Civil AI gateway status',response.status);
  const message=response.status===402?'رصيد AI Gateway غير كافٍ. فعّل الفوترة أو الرصيد في Vercel.':
    response.status===401||response.status===403?'AI Gateway غير مصرح له بالاتصال. افحص إعداداته في Vercel.':
    response.status===429?'خدمة الذكاء الاصطناعي مزدحمة أو تجاوزت الحد. جرّب لاحقًا.':'تعذر اتصال النموذج (HTTP '+response.status+').';
  throw Object.assign(Error(message),{status:503});
 }
 const result=await response.json();
 const item=result.choices?.[0]?.message;
 if(!item)throw Error('لم يُرجع النموذج إجابة.');
 return item;
}
module.exports=async function(req,res){
 res.setHeader('Cache-Control','private,no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method==='GET')return respond(res,200,{enabled:authReady(),model:authReady()?MODEL:null,calculators:true,actionsRequireConfirmation:true,dailyAILimit:null});
 if(req.method!=='POST')return respond(res,405,{error:'Method not allowed'});
 if(!secureOrigin(req))return respond(res,403,{error:'يجب إرسال الطلب من الموقع الأصلي.'});
 if(Number(req.headers['content-length']||0)>4200000)return respond(res,413,{error:'حجم الطلب كبير جدًا.'});
 try{
  if(!process.env.BLOB_READ_WRITE_TOKEN||!process.env.CIVIL_AI_AUTH_SECRET)return respond(res,503,{error:'خدمة الحسابات غير مهيأة.'});
  const user=await userFor(req);
  if(!user)return respond(res,401,{error:'سجل دخولك إلى حسابك أولًا.'});
  const input=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
  if(input.operation==='calculate'){
   try{return respond(res,200,{answer:'تم الحساب بمعادلات ثابتة، مع عرض الفرضيات والوحدات.',calculations:[calc(input.calculation?.kind,input.calculation?.values)],actions:[],mode:'calculator'})}
   catch(e){return respond(res,400,{error:e.message})}
  }
  if(input.operation!=='chat')return respond(res,400,{error:'نوع العملية غير مدعوم.'});
  const question=String(input.question||'').trim();
  if(question.length<2||question.length>4000)return respond(res,400,{error:'أدخل سؤالًا من 2 إلى 4000 حرف.'});
  const image=String(input.attachmentDataUrl||'');
  if(image&&(!/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=\s]+$/i.test(image)||image.length>3900000))
   return respond(res,415,{error:'المرفقات المدعومة حاليًا: صورة PNG أو JPEG أو WebP لا تتجاوز 2.8 MB. لا ترفع PDF هنا.'});
  if(!authReady())return respond(res,200,offlineAnswer(question));
  const history=Array.isArray(input.history)?input.history.slice(-6).filter(m=>['user','assistant'].includes(m.role)&&typeof m.content==='string').map(m=>({role:m.role,content:m.content.slice(0,1600)})):[];
  const system='أنت مساعد Civil AI للهندسة المدنية. أجب بلغة المستخدم (العربية أو الإنجليزية) بوضوح. استخدم الأدوات البرمجية المعطاة لحساب أي مسألة مدعومة: لا تنفذ حسابات إنشائية عددية من الذاكرة إذا توفرت لها أداة. وضح الفروض والوحدات والخطوات والتحقق المعقول من النتائج. إذا نقصت بيانات، اسأل عنها ولا تفترض أبعادًا أو أحمالًا أو كودًا. لا تدّعِ إجراء تحليل FEM أو قراءة ملف DWG/Robot أو فحص تصميم معتمد إذا لم تنفذه أداة فعلية. لا تختلق بنود كود أو مراجع. تستطيع اقتراح التنقل أو تعبئة نموذج عبر open_tool وprepare_main_form فقط؛ لا تقل إنه تم تطبيق التغييرات، بل إنه يحتاج موافقة المستخدم. لا تحفظ أو تحذف أو ترسل بيانات. أعط خلاصة موجزة وفوائد وحدود النتائج. الحسابات الأولية لا تغني عن مهندس مرخص.';
  const content=image?[{type:'text',text:question},{type:'image_url',image_url:{url:image,detail:'low'}}]:question;
  const messages=[{role:'system',content:system},...history,{role:'user',content}];
  const calculations=[],actions=[];
  let answer='';
  for(let turn=0;turn<3;turn++){
   const reply=await askModel(messages);
   if(Array.isArray(reply.tool_calls)&&reply.tool_calls.length){
    const calls=reply.tool_calls.slice(0,6);
    messages.push({role:'assistant',content:reply.content||null,tool_calls:calls});
    for(const call of calls){
     let result;
     try{
      const args=JSON.parse(call.function?.arguments||'{}'),name=String(call.function?.name||'');
      if(['open_tool','prepare_main_form'].includes(name)){
       result=act(name,args);if(actions.length<4)actions.push(result);
      }else if(Object.hasOwn(specs,name)){
       result=calc(name,args);if(calculations.length<4)calculations.push(result);
      }else result={error:'أداة غير متاحة.'};
     }catch(e){result={error:String(e.message).slice(0,180)}}
     messages.push({role:'tool',tool_call_id:call.id,content:JSON.stringify(result)});
    }
   }else {answer=typeof reply.content==='string'?reply.content.trim():'';break}
  }
  if(!answer&&calculations.length)answer='هذه نتائج الأدوات الحسابية. تأكد من الفروض والوحدات قبل استخدامها في التصميم.';
  if(!answer&&actions.length)answer='اقتراحات للتحكم في Civil AI؛ اضغط على الزر للتأكيد قبل تطبيقها.';
  if(!answer)answer='لم أتمكن من إكمال الرد. جرّب سؤالًا أكثر تحديدًا.';
  return respond(res,200,{answer:answer.slice(0,9000),calculations,actions,mode:'ai',model:MODEL});
 }catch(e){
  console.error('Civil AI assistant error:',String(e.name||'Error'));
  return respond(res,e.status||500,{error:e.status?e.message:'تعذر تشغيل المساعد الآن. تحقق من اتصال AI Gateway أو جرّب الحاسبة الهندسية.'});
 }
};