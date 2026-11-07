/* Shared navigation and light/dark appearance for Civil AI pages. */
(function(){
 'use strict';
 const KEY='civilai-site-theme-v2';
 const choices=[['/','⌂ الرئيسية','home'],['/studio.html','⌁ المختبر','studio'],['/satellite-land.html','◈ قياس الخرائط','satellite'],['/assistant.html','✦ المساعد','assistant']];
 function getTheme(){try{return localStorage.getItem(KEY)||'light'}catch{return 'light'}}
 function setTheme(value){const theme=value==='light'?'light':'dark';document.documentElement.setAttribute('data-civil-theme',theme);
  try{localStorage.setItem(KEY,theme)}catch{}
  document.querySelectorAll('.civil-theme-toggle').forEach(btn=>{btn.textContent=theme==='light'?'☾ الوضع الداكن':'☼ الوضع الفاتح';btn.setAttribute('aria-label',theme==='light'?'تفعيل الوضع الداكن':'تفعيل الوضع الفاتح')});
 }
 function toggle(){setTheme(getTheme()==='light'?'dark':'light')}
 function button(){const b=document.createElement('button');b.type='button';b.className='civil-theme-toggle';b.addEventListener('click',toggle);return b}
 function page(){const p=location.pathname;if(p.endsWith('studio.html'))return 'studio';if(p.endsWith('satellite-land.html'))return 'satellite';if(p.endsWith('assistant.html'))return 'assistant';return null}
 function init(){
  if(!document.body||document.querySelector('.civil-global'))return;
  const path=location.pathname;
  if(path==='/'||path.endsWith('/index.html')){
   const slot=document.querySelector('.topactions');if(slot){const b=button();b.classList.add('civil-home-theme');slot.prepend(b)}
  }else{
   const bar=document.createElement('div');bar.className='civil-global';bar.setAttribute('aria-label','التنقل الرئيسي في Civil AI');
   const name=document.createElement('strong');name.textContent='CIVIL AI / WORKSPACE';
   const menu=document.createElement('nav');menu.setAttribute('aria-label','أقسام الموقع');
   for(const [url,label,key] of choices){const link=document.createElement('a');link.href=url;link.textContent=label;if(page()===key)link.setAttribute('aria-current','page');menu.append(link)}
   bar.append(name,menu,button());
   const parent=document.querySelector('main .wrap, main .container, .main, .wrap, .container, main')||document.body;
   parent.prepend(bar);
   // One shared route appears once; keep page-specific controls and tools.
   const duplicateMenuLinks=document.querySelectorAll('.links a, .navlinks a, header nav a');
   duplicateMenuLinks.forEach(a=>{try{
    const u=new URL(a.getAttribute('href'),location.href);
    if(u.origin===location.origin&&choices.some(([route])=>u.pathname===route&&u.search===''))a.remove();
   }catch{}});

  }
  setTheme(getTheme());
 }
 document.documentElement.setAttribute('data-civil-theme',getTheme());
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
