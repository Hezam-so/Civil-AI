/* Civil AI: client-only, print-ready engineering calculation report.
 * Only verified calculation-tool output is included; AI prose is not treated as a measured result.
 * No data is uploaded, saved or printed without a user click. */
'use strict';
(function(root){
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=x=>{
  if(typeof x==='number')return Number.isFinite(x)?Number(x.toPrecision(10)).toLocaleString('en-US',{maximumFractionDigits:8}):'—';
  if(x===null||x===undefined)return '—';
  if(typeof x==='object')return JSON.stringify(x).slice(0,2400);
  return String(x).slice(0,2400);
 };
 const labels={
  areaM2:'المساحة (م²)',perimeterM:'المحيط (م)',vertices:'عدد الزوايا',
  netVolumeM3:'الحجم الصافي (م³)',purchaseVolumeM3:'الحجم مع الهدر (م³)',
  cementKg:'الأسمنت (كجم)',cementBags:'أكياس الأسمنت',sandKgSSD:'الرمل (كجم SSD)',
  gravelKgSSD:'الحصى (كجم SSD)',waterLitres:'ماء الخلط (لتر)',
  steelWeightKg:'وزن الحديد (كجم)',barCount:'عدد الأسياخ',barLengthM:'طول السيخ (م)',
  diameterMm:'قطر السيخ (مم)',maxMomentKnM:'العزم الأقصى (kN.m)',
  maxShearKn:'القص الأقصى (kN)',reactionEachKn:'رد الفعل لكل مسند (kN)',
  spanM:'البحر (م)',pressureKpa:'ضغط التربة (kPa)'
 };
 const makeDocument=calcs=>{
  const safe=(Array.isArray(calcs)?calcs:[]).slice(0,8).filter(c=>c&&typeof c==='object'&&c.result&&typeof c.result==='object');
  if(!safe.length)throw Error('لا توجد نتائج حسابية موثوقة لإعداد التقرير.');
  const date=new Intl.DateTimeFormat('ar-YE',{dateStyle:'long',timeStyle:'short'}).format(new Date());
  const sections=safe.map((calc,i)=>{
   const rows=Object.entries(calc.result).slice(0,55)
    .map(([key,value])=>'<tr><th scope="row">'+esc(labels[key]||key)+'</th><td dir="auto">'+esc(fmt(value))+'</td></tr>').join('');
   const formulas=Array.isArray(calc.formulae)?calc.formulae.slice(0,12).map(f=>'<li>'+esc(String(f).slice(0,500))+'</li>').join(''):'';
   const assumptions=Array.isArray(calc.assumptions)?calc.assumptions.slice(0,16).map(f=>'<li>'+esc(String(f).slice(0,800))+'</li>').join(''):'';
   return '<section class="calculation"><h2>'+(i+1)+'. '+esc(String(calc.title||calc.kind||'حساب هندسي').slice(0,160))+'</h2>'+
    '<table><thead><tr><th>البند</th><th>القيمة / النتيجة</th></tr></thead><tbody>'+rows+'</tbody></table>'+
    (formulas?'<h3>المعادلات</h3><ul>'+formulas+'</ul>':'')+
    (assumptions?'<h3>الافتراضات والقيود</h3><ul>'+assumptions+'</ul>':'')+'</section>';
  }).join('');
  return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Civil AI | تقرير الحسابات الهندسية</title>'+
  '<style>:root{font-family:Tahoma,Arial,system-ui,sans-serif;color:#27323a;background:#f7f4ed}body{margin:0 auto;padding:27px;max-width:850px;line-height:1.75}header{border-bottom:3px solid #895341;padding-bottom:14px;margin-bottom:18px}h1{color:#704837;font-size:26px;margin:0}h2{font-size:19px;color:#7e4c3a;border-bottom:1px solid #d9d0c5;padding-bottom:6px}h3{font-size:14px;margin-bottom:0}small,.meta{color:#5b6871}.report{background:#fff;padding:26px;border-radius:10px}.calculation{break-inside:avoid;margin:26px 0}table{width:100%;border-collapse:collapse;font-size:13px}td,th{text-align:right;border:1px solid #d3d3d3;padding:8px 10px;overflow-wrap:anywhere}thead{background:#f0e9e1}tbody tr:nth-child(even){background:#faf8f5}ul{padding-right:22px;font-size:13px}.notice{background:#f5f0e9;border-right:3px solid #895341;padding:12px;margin-top:20px;font-size:13px}.actions{margin:0 0 18px;display:flex;gap:10px}.actions button{background:#895341;color:#fff;border:none;border-radius:8px;padding:10px 16px;font:inherit;cursor:pointer}footer{border-top:1px solid #bbb;margin-top:30px;padding-top:12px;color:#687078;font-size:11px}@media print{@page{size:A4;margin:14mm}body{background:#fff;padding:0;max-width:none}.report{padding:0}.actions{display:none}.calculation{break-inside:auto}thead{background:#f0e9e1!important;print-color-adjust:exact}}<\/style></head><body><div class="actions"><button onclick="window.print()">طباعة التقرير / حفظ PDF</button><button onclick="window.close()">إغلاق</button></div><main class="report"><header><h1>Civil AI — تقرير الحسابات الهندسية</h1><div class="meta">تاريخ الإعداد: '+esc(date)+'</div><small>تقرير أعد من نتائج حاسبات البرنامج بناءً على مدخلات المستخدم</small></header>'+sections+
   '<p class="notice"><strong>تنبيه هندسي:</strong> الحسابات تقديرية ومرتبطة بفرضيات الحالات المدعومة. هذا التقرير لا يمثل مخططاً تنفيذياً أو شهادة رفع مساحي أو اعتماداً إنشائياً، ويلزم فحص الأبعاد والأحمال والمواد والكود بواسطة مهندس مختص قبل التنفيذ.</p><footer>تم إنشاء هذا التقرير محليًا من موقع Civil AI. لا يحفظه الموقع تلقائيًا؛ استخدم أمر الطباعة واختر «حفظ كملف PDF».</footer></main></body></html>';
 };
 const open=calcs=>{
  const html=makeDocument(calcs);
  const tab=window.open('','_blank');
  if(!tab)throw Error('منع المتصفح فتح نافذة التقرير. اسمح بالنوافذ المنبثقة للموقع ثم أعد المحاولة.');
  tab.document.open();
  tab.document.write(html);
  tab.document.close();
  tab.focus();
 };
 root.CivilEngineeringReport={open,makeDocument};
})(window);