/* Civil AI service directory — quick start, accessible discovery, full search and filters. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const root=$('serviceGrid');if(!root)return;
 const search=$('serviceSearch');
 const buttons=[...document.querySelectorAll('#home .portal-filter')];
 const shortcuts=[...document.querySelectorAll('#home [data-category-jump]')];
 const cards=[...root.querySelectorAll('.portal-card')];
 const count=$('serviceCount'),empty=$('serviceEmpty'),more=$('serviceMore');
 const popular=new Set(['assistant.html','satellite-land.html','studio.html','irregular-land.html']);
 const popularPages=new Set(['concrete','beam']);
 let category='all',expanded=false,lang='ar';
 const arabicNormalize=s=>String(s||'').toLowerCase().replace(/[\u064b-\u065f\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه');
 const phrases={
  ar:{search:'ابحث عن خدمة أو أداة هندسية...',count:(visible,total)=>visible===total?total+' خدمة متاحة':'عرض '+visible+' من '+total+' خدمة',empty:'لا توجد خدمات تطابق بحثك. جرّب اسمًا آخر.',show:'عرض جميع الأدوات',less:'عرض الأدوات الأساسية'},
  en:{search:'Find an engineering tool or service...',count:(visible,total)=>visible===total?total+' services available':'Showing '+visible+' of '+total+' tools',empty:'No matching services. Try another term.',show:'Show all tools',less:'Show essential tools'}
 };
 function isPopular(card){
  const ref=card.getAttribute('href');
  return popular.has(ref)||popularPages.has(card.dataset.go||'');
 }
 function filter(){
  const query=arabicNormalize(search.value.trim()),matches=[];
  for(const card of cards){
   const labels=[...card.querySelectorAll('[data-menu-ar]')].flatMap(el=>[el.dataset.menuAr||'',el.dataset.menuEn||'']);
   const blob=arabicNormalize([card.textContent,card.dataset.search||'',...labels].join(' '));
   const matchCategory=category==='all'||card.dataset.group===category;
   const matched=matchCategory&&(!query||blob.includes(query));
   if(matched)matches.push(card);
   const show=matched&&(expanded||category!=='all'||query.length>0||isPopular(card));
   card.hidden=!show;
  }
  const visible=matches.filter(card=>!card.hidden).length;
  count.textContent=phrases[lang].count(visible,matches.length);
  empty.hidden=matches.length!==0;
  more.hidden=category!=='all'||query.length>0||matches.length<=visible&&expanded===false;
  // Keep the collapse control visible when the directory was expanded.
  if(category==='all'&&!query&&expanded)more.hidden=false;
  more.setAttribute('aria-expanded',String(expanded));
  more.setAttribute('aria-label',expanded?phrases[lang].less:phrases[lang].show);
  more.firstChild.textContent=expanded?phrases[lang].less+' ':phrases[lang].show+' ';
 }
 function setCategory(value){
  if(!['all','engineering','land','files'].includes(value))return;
  category=value;
  for(const button of buttons){
   const active=button.dataset.filter===value;
   button.classList.toggle('is-active',active);
   button.setAttribute('aria-pressed',String(active));
  }
  filter();
 }
 for(const button of buttons)button.addEventListener('click',()=>setCategory(button.dataset.filter));
 for(const shortcut of shortcuts)shortcut.addEventListener('click',()=>{
  search.value='';
  expanded=false;
  setCategory(shortcut.dataset.categoryJump);
  document.querySelector('#home .portal-directory-title')?.scrollIntoView({behavior:'smooth',block:'start'});
 });
 more.addEventListener('click',()=>{
  expanded=!expanded;filter();
  if(!expanded)document.querySelector('#home .portal-directory-title')?.scrollIntoView({behavior:'smooth',block:'start'});
 });
 search.addEventListener('input',filter);
 function syncLanguage(next){
  lang=next==='en'?'en':'ar';
  document.querySelectorAll('#home [data-menu-ar][data-menu-en]').forEach(element=>{
   element.textContent=element.getAttribute('data-menu-'+lang);
  });
  search.placeholder=phrases[lang].search;
  search.setAttribute('aria-label',phrases[lang].search);
  empty.textContent=phrases[lang].empty;
  filter();
 }
 window.CivilServiceMenu={syncLanguage,setCategory};
 let saved='ar';try{saved=localStorage.getItem('civilLang')||'ar'}catch{}
 syncLanguage(saved);
 setCategory('all');
})();