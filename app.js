const $=id=>document.getElementById(id);let lang=localStorage.getItem('civilLang')||'ar';let currentPage='home';let lastBeam=null,lastConcrete=null;const translations={ar:{tagline:'منصة الهندسة الذكية',home:'الرئيسية',beam:'تحليل الكمرات',concrete:'حساب الخرسانة',units:'تحويل الوحدات',projects:'مشاريعي',assistant:'المساعد الهندسي',studio:'المختبر الهندسي المتقدم',heroTitle:'مساحة عملك الهندسية، أكثر ذكاءً.',heroDesc:'أدوات هندسية عملية لحساب الأحمال والكميات وتحويل الوحدات وإدارة المشاريع في مكان واحد.',start:'ابدأ الحساب الآن ←',tools:'أدوات متاحة',saved:'المشاريع المحفوظة',mode:'وضع العمل',local:'محلي وآمن',explore:'استكشف الأدوات',beamDesc:'ردود الأفعال والعزم والقص لكمرة بسيطة الارتكاز.',concreteDesc:'حجم الخرسانة وتقدير الكميات والتكلفة.',unitsDesc:'تحويلات سريعة للقوى والأطوال والإجهادات.',beamIntro:'كمرة بسيطة الارتكاز مع حمل موزع منتظم على كامل البحر أو حمل مركز في المنتصف.',inputs:'المدخلات',loadType:'نوع الحمل',udl:'حمل موزع منتظم (kN/m)',point:'حمل مركز في المنتصف (kN)',span:'طول البحر L (m)',loadUDL:'شدة الحمل w (kN/m)',loadPoint:'الحمل المركز P (kN)',calculate:'احسب النتائج',disclaimer:'نتائج تعليمية أولية وليست بديلاً عن التصميم والمراجعة وفق الكود المعتمد.',results:'النتائج',saveResult:'حفظ النتيجة كمشروع',concreteIntro:'تقدير حجم عنصر خرساني مستطيل وتكلفته المبدئية.',dimensions:'الأبعاد والتكلفة',length:'الطول (m)',width:'العرض (m)',depth:'السماكة / الارتفاع (m)',waste:'نسبة الهدر (%)',unitCost:'سعر المتر المكعب (عملة تختارها)',estimate:'تقدير الكميات',netVolume:'الحجم الصافي',totalVolume:'الحجم مع الهدر',estimatedCost:'التكلفة التقديرية',yourCurrency:'بعملتك المختارة',concreteNote:'لا يشمل هذا التقدير التسليح أو الشدة أو العمالة إلا إذا أدرجتها ضمن سعر الوحدة.',unitsIntro:'تحويلات دقيقة بين وحدات هندسية شائعة.',category:'الفئة',lengthCat:'الطول',forceCat:'القوة',stressCat:'الإجهاد',value:'القيمة',from:'من',to:'إلى',converted:'النتيجة المحولة',projectsIntro:'تُحفظ حساباتك في حسابك السحابي الخاص وتظهر عند تسجيل الدخول من أي جهاز.',savedCalculations:'الحسابات المحفوظة',export:'تصدير JSON',assistantIntro:'نسخة تجريبية للأسئلة الشائعة؛ لا تستخدم نموذج ذكاء اصطناعي خارجي بعد.',welcome:'مرحبًا! اسألني عن الكمرة بسيطة الارتكاز أو حساب حجم الخرسانة أو كيفية استخدام الأدوات.',send:'إرسال',aiNote:'المساعد الحالي قائم على إجابات محددة. لإضافة ذكاء اصطناعي حقيقي يلزم خادم آمن ومفتاح API.',empty:'لا توجد مشاريع محفوظة بعد.',delete:'حذف',invalid:'أدخل أرقامًا صالحة غير سالبة، ويجب أن تكون الأبعاد أكبر من الصفر.',savedMsg:'تم حفظ الحساب.',noResult:'احسب النتيجة أولًا.',chatFallback:'يمكنني شرح: الكمرة بسيطة الارتكاز، الحمل الموزع، العزم الأقصى، حجم الخرسانة، أو استخدام الأدوات. للمسائل الأخرى يلزم ربط نموذج AI.',chatBeam:'للكمرة بسيطة الارتكاز بحمل موزع على كامل البحر: رد الفعل عند كل مسند = wL/2، وأقصى عزم = wL²/8. افتح أداة تحليل الكمرات لإدخال القيم.',chatConcrete:'حجم الخرسانة لعنصر مستطيل = الطول × العرض × الارتفاع. أضف نسبة الهدر لتقدير كمية الطلب.',chatHelp:'اختر أداة من القائمة الجانبية، أدخل القيم، اضغط احسب، ثم احفظ النتيجة في مشاريعي.'},en:{tagline:'Smart Engineering Platform',home:'Dashboard',beam:'Beam Analysis',concrete:'Concrete Estimator',units:'Unit Converter',projects:'My Projects',assistant:'Engineering Assistant',studio:'Engineering Studio',heroTitle:'Your engineering workspace, smarter.',heroDesc:'Practical tools for structural calculations, quantity estimation, unit conversion and project management in one place.',start:'Start calculating →',tools:'Available tools',saved:'Saved projects',mode:'Workspace mode',local:'Local & private',explore:'Explore tools',beamDesc:'Reactions, shear and bending moment for a simply supported beam.',concreteDesc:'Concrete volume, quantities and preliminary cost.',unitsDesc:'Quick force, length and stress conversions.',beamIntro:'Simply supported beam with full-span uniformly distributed load or a midspan point load.',inputs:'Inputs',loadType:'Load type',udl:'Uniformly distributed load (kN/m)',point:'Midspan point load (kN)',span:'Span L (m)',loadUDL:'Load intensity w (kN/m)',loadPoint:'Point load P (kN)',calculate:'Calculate',disclaimer:'Preliminary educational results, not a substitute for code-compliant design and independent verification.',results:'Results',saveResult:'Save result as project',concreteIntro:'Estimate rectangular concrete element volume and preliminary cost.',dimensions:'Dimensions and cost',length:'Length (m)',width:'Width (m)',depth:'Thickness / height (m)',waste:'Waste allowance (%)',unitCost:'Cost per m³ (your currency)',estimate:'Quantity estimate',netVolume:'Net volume',totalVolume:'Including waste',estimatedCost:'Estimated cost',yourCurrency:'In your selected currency',concreteNote:'Reinforcement, formwork and labor are excluded unless included in your unit cost.',unitsIntro:'Accurate conversions between common engineering units.',category:'Category',lengthCat:'Length',forceCat:'Force',stressCat:'Stress',value:'Value',from:'From',to:'To',converted:'Converted result',projectsIntro:'Calculations saved only in this browser.',savedCalculations:'Saved calculations',export:'Export JSON',assistantIntro:'Demo FAQ assistant; no external AI model is connected yet.',welcome:'Welcome! Ask about simply supported beams, concrete volume, or how to use these tools.',send:'Send',aiNote:'This assistant uses predefined answers. Real AI requires a secure backend and API key.',empty:'No saved projects yet.',delete:'Delete',invalid:'Enter valid nonnegative numbers; dimensions must be greater than zero.',savedMsg:'Calculation saved.',noResult:'Calculate a result first.',chatFallback:'I can explain simply supported beams, UDL, maximum moment, concrete volume, or tool usage. Other questions require an AI integration.',chatBeam:'For a simply supported beam under a full-span UDL: each support reaction = wL/2, and maximum moment = wL²/8. Use Beam Analysis to enter values.',chatConcrete:'Rectangular concrete volume = length × width × height. Add waste allowance for ordering quantities.',chatHelp:'Choose a tool from the sidebar, enter values, calculate, then save it under My Projects.'}};
function t(key){return translations[lang][key]||key}function updateLanguage(){document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';document.querySelectorAll('[data-i]').forEach(el=>{const key=el.dataset.i;if(translations[lang][key])el.textContent=t(key)});$('lang').textContent=lang==='ar'?'English':'العربية';$('chatText').placeholder=lang==='ar'?'اكتب سؤالك الهندسي...':'Type your engineering question...';$('loadLabel').textContent=t($('loadType').value==='udl'?'loadUDL':'loadPoint');$('crumbTitle').textContent=t(currentPage);renderProjects();localStorage.setItem('civilLang',lang);window.CivilConcreteMix?.syncLanguage();window.CivilServiceMenu?.syncLanguage(lang)}function showPage(page){if(page==='assistant'){window.location.href='assistant.html';return}if(!['home','beam','concrete','units','projects'].includes(page))return;currentPage=page;document.querySelectorAll('.page').forEach(x=>x.classList.toggle('shown',x.id===page));document.querySelectorAll('.nav').forEach(x=>x.classList.toggle('active',x.dataset.page===page));$('crumbTitle').textContent=t(page);if(page==='projects')renderProjects();window.scrollTo({top:0,behavior:'smooth'})}document.querySelectorAll('[data-page],[data-go]').forEach(b=>b.addEventListener('click',()=>showPage(b.dataset.page||b.dataset.go)));$('lang').onclick=()=>{lang=lang==='ar'?'en':'ar';updateLanguage()};$('loadType').onchange=()=>{$('loadLabel').textContent=t($('loadType').value==='udl'?'loadUDL':'loadPoint');calcBeam()};const fmt=n=>Number(n.toFixed(4)).toLocaleString(lang==='ar'?'en-US':'en-US',{maximumFractionDigits:4});function valid(...values){return values.every(x=>Number.isFinite(x)&&x>=0)}function calcBeam(){let L=+$('span').value,q=+$('load').value,kind=$('loadType').value;if(!valid(L,q)||L<=0){alert(t('invalid'));return}let R=kind==='udl'?q*L/2:q/2,M=kind==='udl'?q*L*L/8:q*L/4;lastBeam={type:'beam',kind,L,load:q,reaction:R,maxShear:R,maxMoment:M};$('ra').textContent=fmt(R);$('rb').textContent=fmt(R);$('vmax').textContent=fmt(R);$('mmax').textContent=fmt(M);$('beamFormula').textContent=kind==='udl'?'R = wL/2  ·  Vmax = wL/2  ·  Mmax = wL²/8':'R = P/2  ·  Vmax = P/2  ·  Mmax = PL/4';$('loadDrawing').innerHTML=kind==='udl'?Array.from({length:11},(_,i)=>{let x=45+i*35;return `<path d="M${x} 33V91m-5 -9 5 9 5 -9" fill="none" stroke="#f4b65f" stroke-width="2"/>`}).join('')+'<path d="M45 33H395" stroke="#f4b65f" stroke-width="2"/>':'<path d="M220 20V91m-9 -13 9 13 9 -13" fill="none" stroke="#f4b65f" stroke-width="3"/>'}function calcConcrete(){let L=+$('cLength').value,W=+$('cWidth').value,H=+$('cDepth').value,waste=+$('cWaste').value,cost=+$('cCost').value,mode=$('cAreaMode').value;let area=mode==='direct'?+$('cArea').value:L*W;if(!valid(area,H,waste,cost)||area<=0||H<=0||waste>100||(mode!=='direct'&&(!valid(L,W)||L<=0||W<=0))){alert(t('invalid'));lastConcrete=null;return}let net=area*H,gross=net*(1+waste/100),total=gross*cost;const mix=window.CivilConcreteMix?.calculate(gross);if(!mix){lastConcrete=null;return}lastConcrete={type:'concrete',L:mode==='direct'?null:L,W:mode==='direct'?null:W,area,areaMode:mode,H,waste,cost,net,gross,total,mix};$('netVol').textContent=fmt(net);$('grossVol').textContent=fmt(gross);$('totalCost').textContent=fmt(total)}const categories={length:{m:1,cm:.01,mm:.001,km:1000,ft:.3048,in:.0254},force:{N:1,kN:1000,lbf:4.4482216153,kip:4448.2216153},stress:{Pa:1,kPa:1000,MPa:1e6,GPa:1e9,psi:6894.7572932,ksi:6894757.2932}};function populateUnits(){let names=Object.keys(categories[$('unitCategory').value]);$('unitFrom').innerHTML=names.map(x=>`<option>${x}</option>`).join('');$('unitTo').innerHTML=names.map(x=>`<option>${x}</option>`).join('');$('unitTo').selectedIndex=1;convertUnits()}function convertUnits(){let v=+$('unitValue').value,cat=categories[$('unitCategory').value],from=$('unitFrom').value,to=$('unitTo').value;$('unitResult').textContent=Number.isFinite(v)?fmt(v*cat[from]/cat[to])+' '+to:'—'}$('unitCategory').onchange=populateUnits;['unitValue','unitFrom','unitTo'].forEach(id=>$(id).addEventListener('input',convertUnits));
let accountProjects=[];
async function projectApi(action,body=null){
 const response=await fetch('/api/projects?action='+action,{method:body?'POST':'GET',credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{})});
 const result=await response.json().catch(()=>({error:'لم تصل استجابة صحيحة من الخادم'}));
 if(!response.ok)throw Error(result.error||'HTTP '+response.status);
 return result;
}
function getProjects(){return accountProjects}
async function loadAccountProjects(){
 if(!window.CivilAccount){accountProjects=[];renderProjects();return}
 try{
  const response=await projectApi('list');
  accountProjects=(response.projects||[]).map(p=>({...p.data,id:p.id,created:p.createdAt,_title:p.title,ownerName:window.CivilAccount.name,type:p.data?.type||p.type}));
  renderProjects();
 }catch(e){$('projectList').textContent='تعذر تحميل المشاريع من حسابك: '+e.message}
}
async function saveResult(result){
 if(!result){alert(t('noResult'));return}
 if(!window.CivilAccount){alert('سجل الدخول لحفظ المشاريع.');return}
 try{
  await projectApi('create',{title:(result.type==='beam'?'حساب كمرة':'حساب خرسانة')+' — '+new Date().toLocaleDateString('ar'),type:result.type,data:result});
  await loadAccountProjects();alert('حُفظ المشروع في حسابك الخاص ويمكن استعادته من جهاز آخر.');
 }catch(e){alert('تعذر حفظ المشروع سحابيًا: '+e.message)}
}
$('saveBeam').onclick=()=>saveResult(lastBeam);$('saveConcrete').onclick=()=>saveResult(lastConcrete);
function renderProjects(){
 const items=getProjects();
 $('projectCount').textContent=items.length;
 $('projectList').replaceChildren();
 if(!window.CivilAccount){$('projectList').textContent='سجل الدخول لرؤية مشاريعك الخاصة.';return}
 if(!items.length){const p=document.createElement('p');p.className='notice';p.textContent=t('empty');$('projectList').append(p);return}
 items.forEach(p=>{
  const row=document.createElement('div');row.className='projectrow';
  const info=document.createElement('div'),title=document.createElement('strong');
  title.textContent=p._title||(p.type==='beam'?t('beam'):p.type==='concrete'?t('concrete'):p.type||'مشروع');
  const detail=document.createElement('small');
  const note=p.type==='beam'?('L='+p.L+' m · Mmax='+fmt(p.maxMoment)+' kN·m'):p.type==='concrete'?(fmt(p.gross)+' m³ · '+fmt(p.total)):'عمل هندسي محفوظ';
  detail.textContent=note+' · '+new Date(p.created).toLocaleString(lang==='ar'?'ar':'en')+' · '+(p.ownerName||window.CivilAccount.name);
  info.append(title,detail);
  const d=document.createElement('details');d.style.marginTop='7px';
  const summary=document.createElement('summary');summary.textContent='عرض تفاصيل العمل المحفوظ';d.append(summary);
  const pre=document.createElement('pre');pre.style.cssText='white-space:pre-wrap;max-height:270px;overflow:auto;direction:auto;font-size:12px;';
  if(p.type==='studio'){
   pre.textContent='الأداة: '+(p.module||'')+'\n'+(p.fields||[]).map(x=>x.name+': '+x.value).join('\n')+'\n\nملخص الناتج:\n'+String(p.summary||'').slice(0,5000);
  }else pre.textContent=Object.entries(p).filter(([k])=>!['id','ownerName','_title','created'].includes(k)).map(([k,v])=>k+': '+(typeof v==='object'?JSON.stringify(v):v)).join('\n');
  d.append(pre);info.append(d);
  const btn=document.createElement('button');btn.className='danger';btn.textContent=t('delete');
  btn.onclick=async()=>{if(!confirm('هل تريد حذف هذا المشروع من حسابك؟'))return;btn.disabled=true;try{await projectApi('delete',{id:p.id});await loadAccountProjects()}catch(e){alert(e.message);btn.disabled=false}};
  row.append(info,btn);$('projectList').append(row);
 });
}
$('exportProjects').onclick=()=>{
 const blob=new Blob([JSON.stringify(getProjects(),null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='civil-ai-private-projects.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),500);
};
window.addEventListener('civil-auth-ready',loadAccountProjects);
if(window.CivilAccount)loadAccountProjects();
function chatReply(q){q=q.toLowerCase();if(/beam|girder|كمرة|كمره|عزم|moment|shear|قص|حمل موزع|udl/.test(q))return t('chatBeam');if(/concrete|خرسان|volume|حجم/.test(q))return t('chatConcrete');if(/help|how|استخدام|كيف|أداة|tool/.test(q))return t('chatHelp');return t('chatFallback')}function addBubble(text,who){let div=document.createElement('div');div.className='bubble '+who;div.textContent=text;$('chatLog').append(div);$('chatLog').scrollTop=$('chatLog').scrollHeight}$('chatForm').onsubmit=e=>{e.preventDefault();let q=$('chatText').value.trim();if(!q)return;addBubble(q,'user');addBubble(chatReply(q),'bot');$('chatText').value=''};$('calcBeam').onclick=calcBeam;$('calcConcrete').onclick=calcConcrete;updateLanguage();window.CivilConcreteMix?.syncLanguage();populateUnits();calcBeam();calcConcrete();

// Approved assistant navigation/prefill — client-side and ephemeral (no save/delete).
(function resumeApprovedAssistantAction(){
 try{
  const where=new URLSearchParams(window.location.search).get('open');
  if(['home','beam','concrete','units','projects'].includes(where))showPage(where);
  const raw=sessionStorage.getItem('civilai_confirmed_ai_prefill');
  if(!raw)return;
  sessionStorage.removeItem('civilai_confirmed_ai_prefill');
  const a=JSON.parse(raw);
  if(!a||!['beam','concrete'].includes(a.page)||!Number.isFinite(a.at)||Date.now()-a.at>5*60*1000||a.at>Date.now())return;
  const allowed=a.page==='beam'?{span:[.01,500],load:[0,1e6]}:{cLength:[.001,10000],cWidth:[.001,10000],cDepth:[.001,1000],cWaste:[0,100],cCost:[0,1e12],cArea:[.001,1e10]};
  if(!a.fields||typeof a.fields!=='object')return;
  for(const [id,v] of Object.entries(a.fields)){
   if(id==='cAreaMode'&&a.page==='concrete'){
    if(v==='direct')$('cAreaMode').value='direct';
    continue;
   }
   if(id==='loadType'&&a.page==='beam'){
    if(['udl','point'].includes(v))$('loadType').value=v;
    continue;
   }
   if(!Object.hasOwn(allowed,id)||typeof v!=='number'||!Number.isFinite(v)||v<allowed[id][0]||v>allowed[id][1])continue;
   const el=$(id);if(el)el.value=v;
  }
  showPage(a.page);
  if(a.page==='beam')$('loadType').dispatchEvent(new Event('change'));
  if(a.page==='concrete')$('cAreaMode').dispatchEvent(new Event('change'));
  // Changes are visible in the form. Saving remains a separate user action.
 }catch(e){console.warn('Assistant prefill was not applied')}
})();

