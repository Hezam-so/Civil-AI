'use strict';
(function(){
 const $=id=>document.getElementById(id),chat=$('chatLog'),outputs=$('toolOutputs');
 const approvedRoutes=new Set(['/?open=home','/?open=beam','/?open=concrete','/?open=units','/?open=projects','/studio.html',
 '/studio.html?open=section','/studio.html?open=footing','/studio.html?open=earth','/studio.html?open=rebar','/studio.html?open=files',
 '/land-area.html','/irregular-land.html','/satellite-land.html','/upload.html','/cad-viewer.html','/model-viewer.html','/robot-viewer.html','/assistant.html']);
 const extraSelectOptions={loadType:['udl','center_point'],unit:['sanaa_labna','dhamar_labna','amran_labna','taiz_10_qasaba','hectare','acre']};
 const definitions={
 beam_udl:[['spanM','طول البحر L (م)',6],['loadKnPerM','الحمل المنتظم w (kN/m)',10]],
 beam_point:[['spanM','طول البحر L (م)',6],['loadKn','الحمل المركز P (kN)',20]],
 concrete_volume:[['lengthM','الطول (م)',5],['widthM','العرض (م)',4],['heightM','الارتفاع/السماكة (م)',.2],['wastePercent','الهدر (%)',5],['unitCost','سعر المتر المكعب (اختياري)',null]],
 footing_pressure:[['axialLoadKn','الحمل المحوري (kN)',300],['lengthM','طول القاعدة (م)',2],['widthM','عرض القاعدة (م)',2],['allowableKpa','ضغط التربة المسموح (kPa، اختياري)',null]],
 rebar_weight:[['diameterMm','قطر السيخ (mm)',16],['totalLengthM','مجموع أطوال الأسياخ (m)',100]],
 rect_section:[['widthMm','عرض القطاع (mm)',300],['heightMm','ارتفاع القطاع (mm)',500]],
 convert_units:[['category','الفئة','length'],['from','من وحدة','m'],['to','إلى وحدة','cm'],['value','القيمة',12]],
 concrete_materials:[['areaM2','المساحة (م²)',20],['thicknessM','السماكة (م)',0.2],['wastePercent','الهدر (%)',5],['binderKgM3','المواد الأسمنتية kg/m³',350],['waterBinderRatio','نسبة الماء/الرابط',0.5],['gravelKgM3','الحصى kg/m³',1050]],
 triangle_heron:[['aM','الضلع الأول (م)',3],['bM','الضلع الثاني (م)',4],['cM','الضلع الثالث (م)',5]],
 rebar_schedule:[['diameterMm','قطر السيخ (mm)',16],['barLengthM','طول السيخ (م)',6],['quantity','عدد الأسياخ',20],['wastePercent','الهدر (%)',5]],
 beam_deflection:[['spanM','طول البحر (م)',6],['loadType','نوع الحمل','udl'],['loadValue','w (kN/m) أو P (kN)',10],['elasticModulusGpa','معامل المرونة E (GPa)',25],['inertiaMm4','عزم القصور Ix (mm⁴)',250000000]],
 yemeni_land_units:[['areaM2','المساحة (م²)',444.4],['unit','الوحدة','sanaa_labna']]
 };
 const unitSets={length:['m','cm','mm','km','ft','in'],force:['N','kN','lbf','kip'],pressure:['Pa','kPa','MPa','GPa','psi','ksi'],area:['m2','cm2','mm2','ft2']};
 const fields=$('fields');
 function buildForm(){
  const kind=$('kind').value;fields.replaceChildren();
  for(const [key,title,example] of definitions[kind]){
   const label=document.createElement('label');label.htmlFor='f_'+key;label.textContent=title;
   const selectOptions=kind==='convert_units'?(key==='category'?Object.keys(unitSets):key==='from'||key==='to'?unitSets[$('f_category')?.value||'length']:null):(extraSelectOptions[key]||null);
   const input=selectOptions?document.createElement('select'):document.createElement('input');
   input.id='f_'+key;input.dataset.key=key;
   if(selectOptions){
    selectOptions.forEach(value=>{const option=document.createElement('option');option.value=value;option.textContent=value;input.append(option)});
    input.value=example;
    if(key==='category')input.addEventListener('change',()=>{const type=input.value;for(const [i,k] of ['from','to'].entries()){const sel=$('f_'+k);sel.replaceChildren();for(const value of unitSets[type]){const opt=document.createElement('option');opt.value=value;opt.textContent=value;sel.append(opt)}sel.value=unitSets[type][i]||unitSets[type][0]}})
   }else{input.type='number';input.step='any';input.inputMode='decimal';if(example===null){input.placeholder='اختياري'}else{input.value=example;input.required=true}}
   fields.append(label,input);
  }
 }
 buildForm();$('kind').addEventListener('change',buildForm);
 const api=async(body)=>{
  const response=await fetch('/api/assistant',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data=await response.json().catch(()=>({error:'تعذر قراءة رد الخادم.'}));
  if(!response.ok)throw Error(data.error||'HTTP '+response.status);
  return data;
 };
 const outputResult=(parent,title,calcs,actions)=>{
  if(title){const heading=document.createElement('h3');heading.textContent=title;parent.append(heading)}
  for(const item of calcs||[]){
   const article=document.createElement('div');article.className='result';
   const name=document.createElement('h3');name.textContent=item.title||'النتيجة الهندسية';article.append(name);
   const pre=document.createElement('pre');
   pre.textContent=Object.entries(item.result||{}).map(([key,val])=>key+' = '+(typeof val==='object'?JSON.stringify(val,null,2):String(val))).join('\n');
   article.append(pre);
   if(item.formulae?.length){const p=document.createElement('p');p.className='small';p.textContent='المعادلات: '+item.formulae.join(' · ');article.append(p)}
   if(item.assumptions?.length){const ul=document.createElement('ul');ul.className='small';for(const txt of item.assumptions){const li=document.createElement('li');li.textContent=txt;ul.append(li)}article.append(ul)}
   parent.append(article);
  }
  for(const action of actions||[]){
   if(action?.type!=='navigate'&&action?.type!=='prefill')continue;
   const row=document.createElement('div');row.className='result';
   const explain=document.createElement('p');explain.textContent=action.type==='prefill'?'اقتراح تعبئة نموذج الحساب. راجع القيم قبل موافقتك: '+JSON.stringify(action.fields||{}):'اقتراح الانتقال إلى قسم '+action.page+' في '+action.target;
   row.append(explain);
   const button=document.createElement('button');button.className='btn';button.type='button';button.textContent=action.type==='prefill'?'تأكيد تعبئة النموذج':'موافق، افتح القسم';
   button.onclick=()=>{
    if(!window.confirm('هل توافق على '+(action.type==='prefill'?'تعبئة القيم التالية دون حفظها؟':'فتح هذا القسم؟')+'\n'+(action.type==='prefill'?JSON.stringify(action.fields):String(action.page))))return;
    if(action.target==='url'){if(approvedRoutes.has(action.url))location.href=action.url;else alert('رابط غير مدعوم.')}else if(action.target==='main'){
     if(action.type==='prefill')sessionStorage.setItem('civilai_confirmed_ai_prefill',JSON.stringify({page:action.page,fields:action.fields,at:Date.now()}));
     location.href='/?open='+encodeURIComponent(action.page);
    }else if(action.target==='studio'){
     if(action.type==='prefill')sessionStorage.setItem('civilai_confirmed_studio_prefill',JSON.stringify({page:action.page,fields:action.fields,at:Date.now()}));
     location.href='/studio.html?open='+encodeURIComponent(action.page);
    }
   };
   row.append(button);parent.append(row);
  }
 };
 function bubble(role,text){
  const p=document.createElement('div');p.className='msg '+role;p.textContent=text;chat.append(p);chat.scrollTop=chat.scrollHeight;return p;
 }
 $('calcForm').addEventListener('submit',async(e)=>{
  e.preventDefault();const b=$('calcBtn'),target=$('calcOutput');b.disabled=true;target.replaceChildren();
  try{
   const kind=$('kind').value,values={};
   for(const elem of fields.querySelectorAll('[data-key]')){
    if(!elem.value.trim())continue;
    values[elem.dataset.key]=elem.tagName==='SELECT'?elem.value:Number(elem.value);
   }
   const result=await api({operation:'calculate',calculation:{kind,values}});
   outputResult(target,null,result.calculations);
  }catch(err){const p=document.createElement('p');p.className='msg error';p.textContent=err.message;target.append(p)}
  finally{b.disabled=false}
 });
 let history=[],busy=false;
 async function toDataURL(file){
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>2.8*1024*1024)throw Error('اختر صورة PNG/JPEG/WebP أقل من 2.8 MB.');
  return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('لم أتمكن من قراءة الصورة.'));reader.readAsDataURL(file)});
 }
 async function sendQuestion(question){
  if(busy)return;const q=String(question||'').trim();if(q.length<2)return;
  const send=$('send');busy=true;send.disabled=true;bubble('user',q);
  const pending=bubble('ai','جارٍ تحليل السؤال…');
  try{
   const file=$('attachment').files[0];
   const attachmentDataUrl=file?await toDataURL(file):undefined;
   const result=await api({operation:'chat',question:q,aiMode:$('assistantMode').value,history:history.slice(-10),...(attachmentDataUrl?{attachmentDataUrl}:{})});
   pending.textContent=(result.mode==='local'?'[مساعد هندسي محلي]\n':result.provider==='openrouter'?'[مساعد ذكاء اصطناعي خارجي]\n':'')+(result.answer||'لم أستلم جوابًا.');
   if(result.cloudUnavailable){
    $('assistantMode').value='local';
    $('aiStatus').textContent=result.gatewayIssue==='access-denied'
      ?'رفض مزوّد '+(result.cloudProvider==='openrouter'?'OpenRouter':'Vercel AI Gateway')+' الاتصال (403)؛ المساعد المحلي متاح.'
      :'تعذر اتصال مزوّد '+(result.cloudProvider==='openrouter'?'OpenRouter':'Vercel')+'؛ المساعد المحلي متاح.';
    $('assistantModeHint').textContent='تحول المساعد للوضع المحلي تلقائيًا بعد فشل اتصال السحابة. يمكنك اختيار الوضع السحابي مرة أخرى لإعادة المحاولة. لا توجد نماذج مدفوعة احتياطية.';
   }
   const group=document.createElement('div');outputResult(group,null,result.calculations,result.actions);
   if(group.childNodes.length)outputs.prepend(group);
   history.push({role:'user',content:q},{role:'assistant',content:pending.textContent});
   history=history.slice(-12);
   $('question').value='';$('attachment').value='';
  }catch(err){pending.classList.add('error');pending.textContent='تعذر معالجة السؤال: '+err.message}
  finally{busy=false;send.disabled=false;chat.scrollTop=chat.scrollHeight}
 }
 $('chatForm').addEventListener('submit',(e)=>{e.preventDefault();sendQuestion($('question').value)});
 $('clear').onclick=()=>{history=[];chat.replaceChildren();outputs.replaceChildren();bubble('ai','بدأنا محادثة جديدة. كيف يمكنني مساعدتك هندسيًا؟')};
 document.querySelectorAll('[data-question]').forEach(b=>b.onclick=()=>{ $('question').value=b.dataset.question;$('question').focus()});

 // PKCE OAuth login: the user authorizes OpenRouter, but never handles an API key.
 const connectStatus=$('openrouterConnectStatus'),connectBtn=$('openrouterConnect'),disconnectBtn=$('openrouterDisconnect');
 const pkceStore='civilai_openrouter_pending_v1';
 function statusMsg(message){connectStatus.textContent=String(message)}
 async function refreshOpenRouter(){
  try{
   const result=await api({operation:'openrouter_status'});
   connectBtn.hidden=!!result.connected;
   disconnectBtn.hidden=!result.connected;
   statusMsg(result.connected?'متصل بـ OpenRouter في حسابك. يمكنك الآن طرح أسئلة خارجية باستخدام النماذج المجانية.':'لم يُربط OpenRouter بهذا الحساب بعد. اضغط الزر للبدء.');
   if(result.connected){
    $('attachment').disabled=false;
    $('attachment').removeAttribute('aria-disabled');
    $('assistantMode').value='cloud';
    $('aiStatus').textContent='OpenRouter مرتبط بحسابك · نموذج مجاني (يتحقق عمله عند إرسال السؤال)';
   }
  }catch(e){statusMsg('تعذر التحقق من حالة ربط OpenRouter: '+e.message)}
 }
 connectBtn.onclick=async()=>{
  connectBtn.disabled=true;
  try{
   if(!window.crypto?.subtle||!window.crypto?.getRandomValues)throw Error('يتطلب الربط اتصال HTTPS ومتصفحًا حديثًا.');
   const bytes=window.crypto.getRandomValues(new Uint8Array(32));
   const randomBase64=data=>btoa(String.fromCharCode(...data)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
   const verifier=randomBase64(bytes),state=randomBase64(window.crypto.getRandomValues(new Uint8Array(24)));
   const digest=await window.crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier));
   const challenge=randomBase64(new Uint8Array(digest));
   sessionStorage.setItem(pkceStore,JSON.stringify({state,verifier,time:Date.now()}));
   const callback=new URL('/assistant.html',location.origin);
   callback.searchParams.set('or_state',state);
   const authorization=new URL('https://openrouter.ai/auth');
   authorization.searchParams.set('callback_url',callback.toString());
   authorization.searchParams.set('code_challenge',challenge);
   authorization.searchParams.set('code_challenge_method','S256');
   statusMsg('سيتم توجيهك إلى OpenRouter لمنح الإذن...');
   location.assign(authorization.toString());
  }catch(e){connectBtn.disabled=false;statusMsg('تعذر بدء الربط: '+e.message)}
 };
 disconnectBtn.onclick=async()=>{
  if(!confirm('هل تريد فصل OpenRouter عن حسابك في Civil AI؟ قد يبقى المفتاح نشطًا في OpenRouter ويمكن إلغاؤه من حسابك هناك.'))return;
  disconnectBtn.disabled=true;
  try{
   await api({operation:'openrouter_disconnect'});
   statusMsg('تم فصل OpenRouter من Civil AI. لإلغاء صلاحية المفتاح نفسه نهائيًا، ألغِه أيضًا من لوحة OpenRouter.');
   $('attachment').disabled=true;
   await refreshOpenRouter();
  }catch(e){statusMsg('تعذر فصل الحساب: '+e.message)}
  finally{disconnectBtn.disabled=false}
 };
 async function oauthCallback(){
  const url=new URL(location.href),code=url.searchParams.get('code');
  if(!code)return;
  const externalState=url.searchParams.get('or_state');
  // Remove the sensitive one-time code from the visible URL immediately.
  url.searchParams.delete('code');url.searchParams.delete('or_state');
  history.replaceState(null,'',url.pathname+url.search+url.hash);
  const stored=sessionStorage.getItem(pkceStore);
  sessionStorage.removeItem(pkceStore);
  if(!stored)throw Error('جلسة الربط غير موجودة. ابدأ من زر ربط OpenRouter مجددًا.');
  const expected=JSON.parse(stored);
  if(expected.state!==externalState||Date.now()-expected.time>10*60*1000||expected.time>Date.now())throw Error('رمز التحقق من جلسة الربط غير مطابق أو انتهت صلاحيته.');
  statusMsg('جارٍ تفعيل اتصال OpenRouter بصورة آمنة...');
  await api({operation:'openrouter_connect',code,codeVerifier:expected.verifier});
  await refreshOpenRouter();
 }
 (async()=>{try{await oauthCallback();}catch(e){statusMsg('فشل ربط OpenRouter: '+e.message)}finally{await refreshOpenRouter()}})();

 (async()=>{
  try{
   const response=await fetch('/api/assistant',{method:'GET',cache:'no-store',credentials:'same-origin'});
   if(!response.ok)throw Error('الخدمة غير متاحة');
   const info=await response.json();
   $('aiStatus').textContent=info.providerMessage|| (info.enabled?'المزوّد الخارجي مهيأ ولم يتم اختبار طلب فعلي.':'المساعد المحلي متاح، والمزوّد الخارجي يحتاج إعدادًا.');
   if(info.openrouterConfigured){
    $('assistantModeHint').textContent='تم إعداد OpenRouter مع وضع النموذج المجاني فقط. تعتمد الإجابات الخارجية على نجاح الاتصال وحدود النموذج المجاني. يطلب المساعد موافقتك قبل تعبئة النماذج أو الانتقال.';
    $('attachment').disabled=false;
    $('attachment').removeAttribute('aria-disabled');
    $('attachment').title='تحليل الصور متاح عند نجاح اتصال مزوّد OpenRouter المجاني؛ الصور تُرسل خارج الموقع عند الإرفاق';
   }
   if(!info.enabled)$('chatHint').textContent+=' يمكنك ربط OpenRouter من الزر أعلى الصفحة دون إدخال مفتاح API يدويًا.';
  }catch(e){$('aiStatus').textContent='فشل الاتصال بخادم المساعد — '+e.message}
 })();
})();
