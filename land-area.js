'use strict';
(() => {
const $=id=>document.getElementById(id);
const units=[
 {id:'labna_sanaa',ar:'اللبنة الصنعانية',en:'Sana’a labnah',region:'sanaa',arRegion:'صنعاء',enRegion:'Sana’a',m2:44.44,kind:'yemeni',source:'maskani'},
 {id:'labna_dhamar',ar:'اللبنة الذمارية',en:'Dhamar labnah',region:'dhamar',arRegion:'ذمار',enRegion:'Dhamar',m2:114.49,kind:'yemeni',source:'maskani'},
 {id:'labna_amran',ar:'اللبنة العمرانية',en:'Amran labnah',region:'amran',arRegion:'عمران',enRegion:'Amran',m2:64,kind:'yemeni',source:'maskani'},
 {id:'labna_saadah',ar:'اللبنة الصعدية (الحبلة)',en:'Sa’dah labnah (hablah)',region:'saadah',arRegion:'صعدة',enRegion:'Sa’dah',m2:28.09,kind:'yemeni',source:'maskani'},
 {id:'habla_radaa',ar:'الحبلة الرداعية',en:'Rada’a hablah',region:'radaa',arRegion:'رداع',enRegion:'Rada’a',m2:81,kind:'yemeni',source:'moj'},
 {id:'habla_jawqi',ar:'الحبلة الجوقية (وفق الدليل)',en:'Jawqi hablah (as listed)',region:'jawqi',arRegion:'الجوقي — راجع المنطقة',enRegion:'Jawqi — verify locality',m2:9,kind:'yemeni',source:'moj'},
 {id:'labna_huwi',ar:'اللبنة الحوئية (وفق الدليل)',en:'Huwi labnah (as listed)',region:'huwi',arRegion:'الحوئي — راجع المنطقة',enRegion:'Huwi — verify locality',m2:64,kind:'yemeni',source:'moj'},
 {id:'qasaba_taiz_10',ar:'القصبة العشارية',en:'Taiz 10-dhira qasabah',region:'taiz',arRegion:'تعز',enRegion:'Taiz',m2:20.25,kind:'yemeni',source:'alaqarya'},
 {id:'qasaba_taiz_12',ar:'القصبة الهدوية (الاثنا عشرية)',en:'Taiz 12-dhira qasabah',region:'taiz',arRegion:'تعز',enRegion:'Taiz',m2:29.16,kind:'yemeni',source:'alaqarya'},
 {id:'qasaba_taiz_16',ar:'القصبة الستاعشرية',en:'Taiz 16-dhira qasabah',region:'taiz',arRegion:'تعز',enRegion:'Taiz',m2:51.84,kind:'yemeni',source:'alaqarya'},
 {id:'qasaba_ibb',ar:'القصبة الإبية',en:'Ibb qasabah',region:'ibb',arRegion:'إب',enRegion:'Ibb',m2:56.25,kind:'yemeni',source:'alaqarya'},
 {id:'maad_sanaa',ar:'المعاد (100 لبنة صنعانية)',en:'Ma’ad (100 Sana’a labnah)',region:'sanaa',arRegion:'صنعاء / شائع',enRegion:'Sana’a / common',m2:4444,kind:'yemeni',source:'maskani'},
 {id:'maad_tihama',ar:'المعاد التهامي',en:'Tihama ma’ad',region:'tihama',arRegion:'تهامة والساحل الغربي',enRegion:'Tihama / western coast',m2:4355.12,kind:'yemeni',source:'maskani'},
 {id:'maad_jizani',ar:'المعاد الجيزاني',en:'Jizani ma’ad',region:'jizani',arRegion:'القياس الجيزاني',enRegion:'Jizani customary measure',m2:3600,kind:'yemeni',source:'maskani'},
 {id:'feddan_egypt',ar:'الفدان المتداول محليًا (4200 م²)',en:'Local feddan (4200 m²)',region:'local_feddan',arRegion:'قياس متداول (راجع المنطقة)',enRegion:'Customary feddan (verify locally)',m2:4200,kind:'yemeni',source:'moj'},
 {id:'qirat_local',ar:'القيراط (من فدان 4200 م²)',en:'Qirat (1/24 of 4200 m² feddan)',region:'local_feddan',arRegion:'قياس متداول (راجع المنطقة)',enRegion:'Customary measure (verify locally)',m2:175,kind:'yemeni',source:'moj'},
 {id:'mm2',ar:'مليمتر مربع',en:'Square millimetre',region:'metric',m2:0.000001,kind:'metric'},
 {id:'cm2',ar:'سنتيمتر مربع',en:'Square centimetre',region:'metric',m2:0.0001,kind:'metric'},
 {id:'dm2',ar:'ديسيمتر مربع',en:'Square decimetre',region:'metric',m2:0.01,kind:'metric'},
 {id:'m2',ar:'متر مربع',en:'Square metre',region:'metric',m2:1,kind:'metric'},
 {id:'are',ar:'آر',en:'Are',region:'metric',m2:100,kind:'metric'},
 {id:'dunam',ar:'دونم متري (1000 م²)',en:'Metric dunam (1000 m²)',region:'metric',m2:1000,kind:'metric'},
 {id:'decare',ar:'ديكار',en:'Decare',region:'metric',m2:1000,kind:'metric'},
 {id:'hectare',ar:'هكتار',en:'Hectare',region:'metric',m2:10000,kind:'metric'},
 {id:'km2',ar:'كيلومتر مربع',en:'Square kilometre',region:'metric',m2:1000000,kind:'metric'},
 {id:'in2',ar:'بوصة مربعة',en:'Square inch',region:'imperial',m2:0.00064516,kind:'imperial'},
 {id:'ft2',ar:'قدم مربع (دولي)',en:'Square foot (international)',region:'imperial',m2:0.09290304,kind:'imperial'},
 {id:'yd2',ar:'ياردة مربعة',en:'Square yard',region:'imperial',m2:0.83612736,kind:'imperial'},
 {id:'rod2',ar:'قصبة إنجليزية مربعة (Rod²)',en:'Square rod / perch',region:'imperial',m2:25.29285264,kind:'imperial'},
 {id:'acre',ar:'فدان إنجليزي (Acre)',en:'Acre',region:'imperial',m2:4046.8564224,kind:'imperial'},
 {id:'mi2',ar:'ميل مربع',en:'Square mile',region:'imperial',m2:2589988.110336,kind:'imperial'}
];
const locales={
 ar:{all:'جميع المناطق',metric:'النظام المتري / الدولي',imperial:'النظام البريطاني / الإنجليزي',custom:'وحدة مخصصة',yemen:'الوحدات اليمنية',loading:'جارٍ التحويل…',invalid:'أدخل مساحة صحيحة لا تقل عن الصفر.',factorBad:'يجب إدخال معامل مساحة موجب وصحيح.',factorSaved:'تم اعتماد المعامل المحلي على هذا الجهاز.',factorRestored:'أُعيدت القيمة المرجعية المتداولة.',saved:'تم حفظ نتيجة التحويل في حسابك الخاص.',saveError:'تعذر حفظ المشروع: ',copied:'تم نسخ نتيجة التحويل.',copyError:'تعذر النسخ. يمكنك نسخ النتيجة يدويًا.',local:'معامل الوحدة المحلية تقديري وقابل للتغيير.',exact:'معامل عالمي ثابت ومعرّف بدقة.',customLabel:'وحدة مخصصة',none:'—',tableEmpty:'لا توجد وحدات مطابقة.',source:'القيم المحلية تقريبية بحسب العرف، وقد تختلف عن سند الملكية.',factor:'م² لكل وحدة'},
 en:{all:'All regions',metric:'Metric / SI',imperial:'British / imperial',custom:'Custom unit',yemen:'Yemeni customary',loading:'Converting…',invalid:'Enter an area greater than or equal to zero.',factorBad:'Enter a valid positive square-metre factor.',factorSaved:'Local factor saved on this device.',factorRestored:'Restored the published reference factor.',saved:'Conversion saved in your private account.',saveError:'Unable to save conversion: ',copied:'Conversion copied.',copyError:'Unable to copy. Copy the result manually.',local:'Customary unit; factor is approximate and editable.',exact:'International definition: exact factor.',customLabel:'Custom local unit',none:'—',tableEmpty:'No matching units.',source:'Local measures are approximate and may differ from the deed.',factor:'m² per unit'}
};
let language='ar';
try{if(JSON.parse(localStorage.getItem('civil-ai-land-area-v1')||'{}').language==='en')language='en'}catch{}
function persist(){try{localStorage.setItem('civil-ai-land-area-v1',JSON.stringify({language}))}catch{}}
function t(ar,en){return language==='ar'?ar:en}
function tr(id){const u=units.find(x=>x.id===id);return u?language==='ar'?u.ar:u.en:id}
function region(u){if(u.kind==='yemeni')return language==='ar'?u.arRegion:u.enRegion;return u.kind==='metric'?locales[language].metric:locales[language].imperial}
function factor(u){return u.m2}
function fmt(number,maximumFractionDigits=8){
 if(!Number.isFinite(number))return '—';
 if(number===0)return '0';
 const abs=Math.abs(number);
 if(abs<0.00000001||abs>=1e15)return number.toExponential(6);
 return new Intl.NumberFormat('en-US',{maximumFractionDigits:abs<0.0001?12:maximumFractionDigits}).format(number);
}
const unit=id=>units.find(x=>x.id===id);
const text=(id,v)=>{$(id).textContent=v};
const shown=()=>[$('fromUnit').value,$('toUnit').value];
function getAmount(){
 const raw=$('areaAmount').value.trim();
 if(raw==='')return NaN;
 const n=Number(raw);
 return Number.isFinite(n)&&n>=0?n:NaN;
}
const opt=(value,label)=>{const o=document.createElement('option');o.value=value;o.textContent=label;return o};
function groupOptions(select,unitList){
 const sections=[['yemeni',locales[language].yemen],['metric',locales[language].metric],['imperial',locales[language].imperial]];
 for(const [kind,title] of sections){
  const matching=unitList.filter(u=>u.kind===kind);
  if(!matching.length)continue;
  const group=document.createElement('optgroup');group.label=title;
  matching.forEach(u=>group.append(opt(u.id,tr(u.id)+(u.kind==='yemeni'?' — '+region(u):''))));
  select.append(group);
 }
}
function renderUnits(){
 const from=$('fromUnit'),to=$('toUnit');
 const fromId=from.value||'labna_sanaa',toId=to.value||'m2';
 from.replaceChildren();to.replaceChildren();
 groupOptions(from,units);groupOptions(to,units);
 from.value=fromId;to.value=toId;
 if(from.selectedIndex<0)from.value='labna_sanaa';
 if(to.selectedIndex<0)to.value='m2';
}
function renderTable(m2){
 const body=$('comparisonRows');body.replaceChildren();
 const search=$('tableSearch').value.trim().toLocaleLowerCase();
 const visible=units.filter(u=>{
  const name=[u.ar,u.en,region(u)].join(' ').toLowerCase();
  return !search||name.includes(search);
 });
 if(!visible.length){const trEl=document.createElement('tr');const td=document.createElement('td');td.colSpan=4;td.textContent=locales[language].tableEmpty;trEl.append(td);body.append(trEl);return}
 visible.forEach(u=>{
  const row=document.createElement('tr');
  const name=document.createElement('td');const bold=document.createElement('strong');bold.textContent=tr(u.id);name.append(bold);
  const other=document.createElement('em');other.textContent=language==='ar'?u.en:u.ar;name.append(other);
  const location=document.createElement('td');location.textContent=region(u);
  const factorTd=document.createElement('td');factorTd.className='numeric';factorTd.textContent=fmt(factor(u),10);
  const converted=document.createElement('td');converted.className='numeric';converted.textContent=Number.isFinite(m2)?fmt(m2/factor(u)):locales[language].none;
  row.append(name,location,factorTd,converted);body.append(row);
 });
}
function convert(){
 const amount=getAmount(),a=unit($('fromUnit').value),b=unit($('toUnit').value);
 if(!a||!b)return;
 const x=factor(a),y=factor(b);
 if(!Number.isFinite(amount)||!Number.isFinite(x)||!Number.isFinite(y)||x<=0||y<=0){
  text('mainResult','—');text('conversionDetail',locales[language].invalid);
  ['inM2','inHectare','inFeet','inAcres'].forEach(id=>text(id,'—'));
  renderTable(NaN);return;
 }
 const m2=amount*x,to=m2/y;
 const result=fmt(to,10)+' '+tr(b.id);
 text('mainResult',result);
 text('conversionLabel',t('المساحة المكافئة','Equivalent area'));
 text('conversionDetail',fmt(amount)+' '+tr(a.id)+' = '+result);
 text('inM2',fmt(m2));text('inHectare',fmt(m2/10000));text('inFeet',fmt(m2/0.09290304));text('inAcres',fmt(m2/4046.8564224));
 renderTable(m2);
}
function applyTranslation(){
 document.documentElement.lang=language;
 document.documentElement.dir=language==='ar'?'rtl':'ltr';
 document.querySelectorAll('[data-ar][data-en]').forEach(el=>{el.textContent=el.dataset[language]});
 text('langButton',language==='ar'?'English':'العربية');
 $('areaAmount').setAttribute('aria-label',t('قيمة المساحة','Area amount'));
 renderUnits();convert();
}
function message(s,isError=false){const el=$('notice');el.textContent=s;el.style.color=isError?'#ffb3ac':'#b8efdd'}
$('langButton').onclick=()=>{
 language=language==='ar'?'en':'ar';applyTranslation();persist();
};
$('fromUnit').onchange=convert;
$('toUnit').onchange=convert;
$('areaAmount').oninput=convert;
$('tableSearch').oninput=convert;
$('swap').onclick=()=>{
 const a=$('fromUnit').value,b=$('toUnit').value;
 $('fromUnit').value=b;$('toUnit').value=a;convert();
};
$('copyResult').onclick=async()=>{
 const a=unit($('fromUnit').value),b=unit($('toUnit').value),amount=getAmount();
 if(!Number.isFinite(amount))return message(locales[language].invalid,true);
 const summary=fmt(amount)+' '+tr(a.id)+' = '+fmt(amount*factor(a)/factor(b),10)+' '+tr(b.id)+'\n= '+fmt(amount*factor(a))+' m²';
 try{await navigator.clipboard.writeText(summary);message(locales[language].copied)}
 catch{message(locales[language].copyError,true)}
};
$('printResult').onclick=()=>window.print();
$('saveResult').onclick=async()=>{
 const a=unit($('fromUnit').value),b=unit($('toUnit').value),amount=getAmount();
 if(!Number.isFinite(amount))return message(locales[language].invalid,true);
 const btn=$('saveResult');btn.disabled=true;
 try{
  const record={type:'land-area',amount,from:a.id,to:b.id,fromName:tr(a.id),toName:tr(b.id),sourceFactor:factor(a),targetFactor:factor(b),m2:amount*factor(a),converted:amount*factor(a)/factor(b),locale:language,createdAt:new Date().toISOString(),note:locales[language].source};
  const response=await fetch('/api/projects?action=create',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:t('تحويل مساحة أرض: ','Land area conversion: ')+tr(a.id)+' → '+tr(b.id),type:'land-area',data:record})});
  const r=await response.json();
  if(!response.ok)throw Error(r.error||'HTTP '+response.status);
  message(locales[language].saved);
 }catch(e){message(locales[language].saveError+e.message,true)}
 finally{btn.disabled=false}
};
renderUnits();
$('fromUnit').value='labna_sanaa';$('toUnit').value='m2';
applyTranslation();
})();
