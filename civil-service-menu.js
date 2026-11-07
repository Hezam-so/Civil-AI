/* Interactive main services grid: one unique card per feature; Arabic/English. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const root=$('serviceGrid');if(!root)return;
 const search=$('serviceSearch');
 const buttons=[...document.querySelectorAll('#home .portal-filter')];
 const cards=[...root.querySelectorAll('.portal-card')];
 const count=$('serviceCount'),empty=$('serviceEmpty');
 let category='all';
 let lang='ar';
 const arabicNormalize=s=>String(s||'').toLowerCase().replace(/[\u064b-\u065f\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه');
 const phrases={ar:{search:'ابحث عن خدمة أو أداة هندسية...',count:n=>n+' خدمة متاحة',empty:'لا توجد خدمات تطابق بحثك. جرّب اسمًا آخر.'},
 en:{search:'Find an engineering tool or service...',count:n=>n+' services available',empty:'No matching services. Try a different term.'}};
 function filter(){
  const query=arabicNormalize(search.value.trim());
  let visible=0;
  for(const card of cards){
   const blob=arabicNormalize([card.innerText,card.dataset.search||'',...card.querySelectorAll('[data-menu-ar]')].join(' '));
   const matchCategory=category==='all'||card.dataset.group===category;
   const show=matchCategory&&(!query||blob.includes(query));
   card.hidden=!show;if(show)visible++;
  }
  count.textContent=phrases[lang].count(visible);
  empty.hidden=visible!==0;
 }
 function setCategory(value){
  category=value;
  for(const button of buttons){
   const active=button.dataset.filter===value;
   button.classList.toggle('is-active',active);
   button.setAttribute('aria-pressed',String(active));
  }
  filter();
 }
 for(const button of buttons)button.addEventListener('click',()=>setCategory(button.dataset.filter));
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
 window.CivilServiceMenu={syncLanguage};
 let saved='ar';try{saved=localStorage.getItem('civilLang')||'ar'}catch{}
 syncLanguage(saved);
 setCategory('all');
})();
