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

 const recoveryApi=async(action,body)=>{
  const r=await fetch('/api/password-recovery?action='+encodeURIComponent(action),{
    method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
  });
  const data=await r.json().catch(()=>({error:'تعذر قراءة رد خدمة الاستعادة.'}));
  if(!r.ok)throw Error(data.error||'HTTP '+r.status);
  return data;
 };
 const emailLookupCache=new Map();
 const validEmail=(mail)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(mail||'').trim())&&String(mail||'').trim().length<=254;
 async function lookupEmail(mail){
   const key=String(mail||'').trim().toLowerCase();
   const prior=emailLookupCache.get(key);
   if(prior&&Date.now()-prior.time<5*60*1000)return prior.result;
   const result=await api('check-email',{email:key});
   emailLookupCache.set(key,{time:Date.now(),result});
   return result;
 }
 function autoCheckEmail(input,statusNode,{onResult}={}){
   let timeout=null,serial=0,lastSeen='';
   const check=async()=>{
     const key=input.value.trim().toLowerCase();
     const ticket=++serial;
     if(!key){statusNode.textContent='';onResult?.(null);return}
     if(!validEmail(key)){statusNode.textContent='أكمل كتابة عنوان بريد إلكتروني صحيح.';onResult?.(null);return}
     if(key===lastSeen&&!statusNode.dataset.error)return;
     lastSeen=key;delete statusNode.dataset.error;
     statusNode.textContent='جاري التحقق من تسجيل البريد…';
     try{
       const answer=await lookupEmail(key);
       if(ticket!==serial||input.value.trim().toLowerCase()!==key)return;
       statusNode.textContent=answer.message||'تم التحقق من البريد.';
       onResult?.(answer);
     }catch(e){
       if(ticket!==serial||input.value.trim().toLowerCase()!==key)return;
       statusNode.dataset.error='true';
       statusNode.textContent=e.message||'تعذر التحقق حاليًا.';
       onResult?.(null);
     }
   };
   input.addEventListener('input',()=>{
     clearTimeout(timeout);serial++;lastSeen='';
     statusNode.textContent=input.value.trim()?'أكمل الكتابة وسيتم الفحص تلقائيًا…':'';
     onResult?.(null);
     if(validEmail(input.value))timeout=setTimeout(check,1400);
   });
   input.addEventListener('blur',()=>{clearTimeout(timeout);if(validEmail(input.value))check()});
   if(validEmail(input.value))timeout=setTimeout(check,300);
   return {check};
 }
 const panel=document.createElement('div');panel.id='civil-auth-overlay';
 const show=(mode='login',initialError='')=>{
  document.body.classList.remove('civil-authenticated');document.body.classList.add('civil-auth-screen');
  panel.replaceChildren();
  const card=document.createElement('div');card.className='auth-card';
  card.innerHTML='<h1>Civil AI <span style="color:#59dbea">| حسابك الخاص</span></h1><p>سجّل الدخول للاطلاع على مشاريعك الخاصة من هذا الحساب.</p><form id="civil-auth-form"><div id="civil-name-field"><label for="civil-name">اسم المستخدم</label><input id="civil-name" type="text" maxlength="90" autocomplete="name" placeholder="الاسم الكامل"></div><label for="civil-email">البريد الإلكتروني</label><input id="civil-email" type="email" autocomplete="email" required placeholder="name@example.com"><label for="civil-password" id="civil-password-label">كلمة المرور</label><input id="civil-password" type="password" autocomplete="current-password" required minlength="6" maxlength="128"><div style="margin-top:17px;display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button id="civil-auth-submit" type="submit">تسجيل الدخول</button><button id="civil-auth-toggle" type="button" class="auth-switch">إنشاء حساب جديد</button><button id="civil-forgot" type="button" class="auth-switch">نسيت كلمة المرور؟</button></div><p id="civil-email-status" class="auth-note" role="status"></p><div class="auth-error" role="alert" id="civil-auth-error"></div></form><p class="auth-note" style="margin-top:16px">كل حساب له مساحة مشاريع خاصة. استخدم بريدك الشخصي. تأكيد ملكية البريد عند إنشاء الحساب غير مفعّل بعد. استعادة كلمة المرور برمز بريد إلكتروني تتطلب تفعيل مزوّد الإرسال. لا تستخدم المنصة لملفات عملاء حساسة قبل اكتمال الحماية والاختبارات.</p>';
  panel.append(card);
  let register=mode==='register';
  const n=card.querySelector('#civil-name-field'),pw=card.querySelector('#civil-password'),btn=card.querySelector('#civil-auth-submit'),toggle=card.querySelector('#civil-auth-toggle'),err=card.querySelector('#civil-auth-error');
  const sync=()=>{n.style.display=register?'block':'none';btn.textContent=register?'إنشاء الحساب':'تسجيل الدخول';toggle.textContent=register?'لدي حساب بالفعل':'إنشاء حساب جديد';pw.autocomplete=register?'new-password':'current-password';pw.minLength=register?8:6;card.querySelector('#civil-password-label').textContent=register?'كلمة مرور جديدة (8 أحرف أو أرقام على الأقل)':'كلمة المرور الخاصة بحسابك'};
  sync();err.textContent=initialError;
  toggle.onclick=()=>{register=!register;sync();err.textContent='';card.querySelector('#civil-email-status').textContent=''};
  const forgot=card.querySelector('#civil-forgot');
  const updateForgot=()=>forgot.style.display=register?'none':'inline-flex';
  updateForgot();
  toggle.addEventListener('click',updateForgot);
  forgot.onclick=()=>showRecovery('request',card.querySelector('#civil-email').value);
  const checkText=card.querySelector('#civil-email-status');
  autoCheckEmail(card.querySelector('#civil-email'),checkText);
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

 const showRecovery=(phase='request',initialEmail='')=>{
  document.body.classList.remove('civil-authenticated');
  document.body.classList.add('civil-auth-screen');
  panel.replaceChildren();
  const card=document.createElement('div');card.className='auth-card';
  const title=document.createElement('h1');title.textContent='استعادة كلمة مرور Civil AI';
  const intro=document.createElement('p');
  intro.textContent=phase==='request'?'أدخل بريدك المسجل وسنرسل رمز تحقق مكوّنًا من 8 أرقام إذا كانت خدمة الإرسال مفعّلة.':'أدخل الرمز الذي وصل لبريدك، واختر كلمة مرور جديدة.';
  const form=document.createElement('form');
  form.innerHTML='<label for="civil-recovery-email">البريد الإلكتروني</label><input id="civil-recovery-email" type="email" required autocomplete="email" maxlength="254"><div id="civil-recovery-fields"><label for="civil-recovery-code">رمز التحقق (8 أرقام)</label><input id="civil-recovery-code" type="text" required inputmode="numeric" autocomplete="one-time-code" minlength="8" maxlength="8" pattern="[0-9]{8}" placeholder="00000000"><label for="civil-new-password">كلمة المرور الجديدة (8 أحرف أو أرقام على الأقل)</label><input id="civil-new-password" type="password" required autocomplete="new-password" minlength="8" maxlength="128"></div><div style="margin-top:17px;display:flex;gap:8px;flex-wrap:wrap"><button type="submit" id="civil-recovery-submit"></button><button type="button" class="auth-switch" id="civil-recovery-back">العودة لتسجيل الدخول</button></div><div class="auth-error" id="civil-recovery-error" role="alert"></div>';
  card.append(title,intro,form);panel.append(card);document.body.append(panel);
  const email=form.querySelector('#civil-recovery-email'),code=form.querySelector('#civil-recovery-code'),pw=form.querySelector('#civil-new-password'),fields=form.querySelector('#civil-recovery-fields'),btn=form.querySelector('#civil-recovery-submit'),err=form.querySelector('#civil-recovery-error');
  email.value=initialEmail||'';
  fields.style.display=phase==='request'?'none':'block';
  // Hidden required inputs otherwise block the email-code request on mobile browsers.
  code.disabled=phase==='request';pw.disabled=phase==='request';
  btn.textContent=phase==='request'?'إرسال رمز التحقق':'تغيير كلمة المرور';
  form.querySelector('#civil-recovery-back').onclick=()=>show('login');
  const message=document.createElement('p');message.id='civil-recovery-message';message.className='auth-note';
  message.textContent=phase==='confirm'?'الرمز صالح لعشر دقائق ويُستخدم مرة واحدة.':'اكتب بريدك وسيتم فحص تسجيله تلقائيًا.';
  let registration=null;
  if(phase==='request'){
    autoCheckEmail(email,message,{onResult:(value)=>{registration=value}});
    fetch('/api/password-recovery?action=status',{credentials:'same-origin',cache:'no-store'})
      .then(r=>r.ok?r.json():null).then(status=>{
        if(status&&!status.emailDeliveryConfigured){
          const explanation='خدمة إرسال الرموز غير مفعّلة على الموقع حتى الآن. اضغط «إرسال رمز التحقق» لمعرفة تفاصيل المشكلة. لا يمكن إرسال رسالة قبل ربط مزود البريد.';
          intro.textContent=explanation;
          btn.title='لم يربط مالك الموقع خدمة إرسال البريد بعد';
        }
      }).catch(()=>{});
  }
  form.onsubmit=async(event)=>{
   event.preventDefault();btn.disabled=true;err.textContent='';
   try{
    if(phase==='request'){
      const found=registration&&emailLookupCache.get(email.value.trim().toLowerCase())?.result===registration?registration:await lookupEmail(email.value);
      if(!found.registered)throw Error('هذا البريد غير مسجّل. يمكنك العودة وإنشاء حساب جديد.');
      // The submit button stays responsive even while outgoing mail is unconfigured.
      const result=await recoveryApi('request',{email:email.value});
      showRecovery('confirm',email.value);
      const msg=panel.querySelector('#civil-recovery-message');
      if(msg)msg.textContent=result.message||'تحقق من بريدك للحصول على رمز الاستعادة.';
    }else{
      const result=await recoveryApi('confirm',{email:email.value,code:code.value,newPassword:pw.value});
      show('login',result.message||'تم تغيير كلمة المرور؛ سجل الدخول من جديد.');
    }
   }catch(e){err.textContent=e.message||'تعذر استعادة كلمة المرور.';btn.disabled=false}
  };
  card.append(message);
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
