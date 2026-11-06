'use strict';
(function(){
 const style=document.createElement('style');
 style.textContent=`
body{visibility:hidden!important}
body.civil-authenticated,body.civil-auth-screen{visibility:visible!important}
body.civil-auth-screen>*:not(#civil-auth-overlay){display:none!important}
#civil-auth-overlay{box-sizing:border-box;position:fixed;z-index:2147483647;inset:0;overflow:auto;display:flex;align-items:center;justify-content:center;padding:18px;background:radial-gradient(circle at 70% 0%,#173c5d,#071424 60%);font:15px/1.65 system-ui,Tahoma,Arial;color:#eaf7ff;direction:rtl}
#civil-auth-overlay *{box-sizing:border-box}#civil-auth-overlay .auth-card{width:min(100%,440px);background:#10253c;border:1px solid #315573;border-radius:18px;padding:26px;box-shadow:0 20px 80px #0005}
#civil-auth-overlay h1{font-size:27px;margin:0 0 6px}#civil-auth-overlay p{color:#b9cadb;margin:0 0 18px}
#civil-auth-overlay label{display:block;margin:12px 0 4px;font-size:14px;color:#cce3f4}
#civil-auth-overlay input{width:100%;padding:12px;border-radius:9px;background:#08182b;border:1px solid #49637b;color:white;font:inherit;direction:auto}
#civil-auth-overlay button{padding:11px 16px;border-radius:10px;border:1px solid #4b9bc7;background:#1879ad;color:white;font:inherit;cursor:pointer}
#civil-auth-overlay button:disabled{opacity:.5}#civil-auth-overlay .auth-switch{background:transparent;border:0;color:#8cdbf6;text-decoration:underline}
#civil-auth-overlay .auth-note{font-size:12px;color:#b8cbe0}#civil-auth-overlay .auth-error{color:#ff9c9c;margin-top:12px;white-space:pre-wrap}
#civil-user-menu{position:fixed;z-index:10000;bottom:15px;left:15px;padding:9px 12px;background:#112d45;border:1px solid #4b718c;border-radius:12px;color:#e8f6ff;box-shadow:0 4px 30px #0006;display:flex;gap:10px;align-items:center;font:13px system-ui,Tahoma,sans-serif;direction:rtl}
#civil-user-menu button{cursor:pointer;background:#1f5070;border:1px solid #4c789a;color:white;border-radius:8px;padding:7px 10px}
`;
 document.head.append(style);
 const api=async(action,body)=>{
  const r=await fetch('/api/account?action='+action,{method:body?'POST':'GET',credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{})});
  let data;try{data=await r.json()}catch{data={error:'تعذر قراءة استجابة الخادم.'}}
  if(!r.ok)throw Error(data.error||'HTTP '+r.status);
  return data;
 };
 const panel=document.createElement('div');panel.id='civil-auth-overlay';
 const show=(mode='login',initialError='')=>{
  document.body.classList.remove('civil-authenticated');document.body.classList.add('civil-auth-screen');
  panel.replaceChildren();
  const card=document.createElement('div');card.className='auth-card';
  card.innerHTML='<h1>Civil AI <span style="color:#59dbea">| حسابك الخاص</span></h1><p>سجّل الدخول للاطلاع على مشاريعك الخاصة من هذا الحساب.</p><form id="civil-auth-form"><div id="civil-name-field"><label for="civil-name">اسم المستخدم</label><input id="civil-name" type="text" maxlength="90" autocomplete="name" placeholder="الاسم الكامل"></div><label for="civil-email">البريد الإلكتروني</label><input id="civil-email" type="email" autocomplete="email" required placeholder="name@example.com"><label for="civil-password">كلمة المرور (6 أحرف أو أرقام على الأقل)</label><input id="civil-password" type="password" autocomplete="current-password" required minlength="6" maxlength="128"><div style="margin-top:17px;display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button id="civil-auth-submit" type="submit">تسجيل الدخول</button><button id="civil-auth-toggle" type="button" class="auth-switch">إنشاء حساب جديد</button></div><div class="auth-error" role="alert" id="civil-auth-error"></div></form><p class="auth-note" style="margin-top:16px">كل حساب له مساحة مشاريع خاصة. استخدم بريدك الشخصي. تأكيد ملكية البريد واستعادة كلمة المرور غير متاحين بعد؛ لا تستخدم المنصة لحفظ ملفات عملاء حساسة قبل تفعيلهما.</p>';
  panel.append(card);
  let register=mode==='register';
  const n=card.querySelector('#civil-name-field'),pw=card.querySelector('#civil-password'),btn=card.querySelector('#civil-auth-submit'),toggle=card.querySelector('#civil-auth-toggle'),err=card.querySelector('#civil-auth-error');
  const sync=()=>{n.style.display=register?'block':'none';btn.textContent=register?'إنشاء الحساب':'تسجيل الدخول';toggle.textContent=register?'لدي حساب بالفعل':'إنشاء حساب جديد';pw.autocomplete=register?'new-password':'current-password'};
  sync();err.textContent=initialError;
  toggle.onclick=()=>{register=!register;sync();err.textContent=''};
  card.querySelector('form').onsubmit=async(e)=>{
   e.preventDefault();btn.disabled=true;err.textContent='';
   try{
    const result=await api(register?'register':'login',{name:card.querySelector('#civil-name').value,email:card.querySelector('#civil-email').value,password:pw.value});
    if(!result.authenticated||!result.user)throw Error('لم يتم تفعيل الحساب.');
    loggedIn(result.user);
   }catch(ex){err.textContent=ex.message||'حدث خطأ أثناء الدخول';btn.disabled=false}
  };
  document.body.append(panel);
 };
 const loggedIn=(user)=>{
  window.CivilAccount=user;document.body.classList.remove('civil-auth-screen');document.body.classList.add('civil-authenticated');panel.remove();
  document.getElementById('civil-user-menu')?.remove();
  const bar=document.createElement('div');bar.id='civil-user-menu';
  const name=document.createElement('span');name.textContent='حساب: '+user.name;
  const logout=document.createElement('button');logout.textContent='تسجيل خروج';
  logout.onclick=async()=>{logout.disabled=true;try{await api('logout',{});location.reload()}catch(e){alert(e.message);logout.disabled=false}};
  bar.append(name,logout);document.body.append(bar);
  window.dispatchEvent(new CustomEvent('civil-auth-ready',{detail:{user}}));
 };
 async function bootstrap(){
  try{const state=await api('session');if(state.authenticated&&state.user)return loggedIn(state.user);show()}
  catch(e){show('login','تعذر الاتصال بخدمة الحسابات: '+e.message)}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootstrap,{once:true});else bootstrap();
})();
