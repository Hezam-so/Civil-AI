'use strict';
/**
 * Civil AI password reset by an 8-digit email code.
 * Transactional email sender: Resend. Requires RESEND_API_KEY and CIVIL_AI_EMAIL_FROM
 * configured on Vercel (the sender must be on a verified domain).
 * Recovery codes are never saved in plaintext, returned to clients or logged.
 */
const crypto = require('node:crypto');
const {get, put, del} = require('@vercel/blob');
const TTL_MS = 10*60*1000;
const COOLDOWN_MS = 15*60*1000;
const MAX_ATTEMPTS = 5;
const inMemory = new Map();
const fail=(res,status,error)=>res.status(status).json({error});
const generic='إذا كان هذا البريد مسجّلًا، فستصلك رسالة برمز الاستعادة خلال دقائق. افحص البريد غير المرغوب أيضًا.';
const norm=s=>String(s||'').trim().toLowerCase();
const emailOK=s=>s.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const accountId=email=>crypto.createHash('sha256').update(email).digest('hex');
const codeDigest=(id,salt,code)=>crypto.createHmac('sha256',process.env.CIVIL_AI_AUTH_SECRET).update(id+'.'+salt+'.'+code).digest('hex');
const same=(a,b)=>{try{const x=Buffer.from(String(a),'hex'),y=Buffer.from(String(b),'hex');return x.length===y.length&&crypto.timingSafeEqual(x,y)}catch{return false}};
function ipOK(req,operation){
 const ip=String(req.headers['x-real-ip']||req.headers['x-forwarded-for']||'unknown').split(',')[0].trim().slice(0,80);
 const key=operation+':'+ip,now=Date.now(),entry=inMemory.get(key);
 const limit=operation==='request'?3:8;
 if(entry&&entry.until>now){if(entry.count>=limit)return false;entry.count++;return true}
 inMemory.set(key,{count:1,until:now+10*60*1000});
 if(inMemory.size>4000)inMemory.clear();
 return true;
}
const read=async(path)=>{
 const b=await get(path,{access:'private'});
 return b?.stream?{value:JSON.parse(await new Response(b.stream).text()),etag:b.etag}:null;
};
const write=(path,data,opts={})=>put(path,JSON.stringify(data),{
 access:'private',contentType:'application/json',addRandomSuffix:false,
 cacheControlMaxAge:60,...opts
});
function sourceOK(req){
 const origin=req.headers.origin,host=req.headers['x-forwarded-host']||req.headers.host;
 return typeof origin==='string'&&origin==='https://'+host;
}
async function send(email,code){
 const from=process.env.CIVIL_AI_EMAIL_FROM;
 const text='رمز إعادة تعيين كلمة مرور Civil AI هو: '+code+
 '\nهذا الرمز صالح لمدة 10 دقائق ولا تشاركه مع أي شخص.\nإذا لم تطلب استعادة كلمة المرور، فتجاهل هذه الرسالة.';
 const html='<div dir="rtl" style="font:16px/1.8 Arial,sans-serif"><h2>استعادة كلمة مرور Civil AI</h2><p>رمز التحقق:</p><p style="font:700 30px monospace;letter-spacing:4px">'+code+'</p><p>صالح لمدة 10 دقائق ويُستخدم مرة واحدة فقط.</p><p>إذا لم تطلب ذلك، تجاهل هذه الرسالة.</p></div>';
 const r=await fetch('https://api.resend.com/emails',{
  method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json'},
  body:JSON.stringify({from,to:[email],subject:'رمز استعادة كلمة المرور — Civil AI',text,html})
 });
 if(!r.ok)throw Error('Email delivery provider rejected the request (HTTP '+r.status+')');
}
async function passwordHash(pass,salt){
 return await new Promise((resolve,reject)=>crypto.scrypt(pass,salt,64,{N:16384,r:8,p:1},(err,b)=>err?reject(err):resolve(b.toString('hex'))));
}
module.exports=async function(req,res){
 res.setHeader('Cache-Control','no-store, private');
 res.setHeader('X-Content-Type-Options','nosniff');
 try{
  if(req.method!=='POST')return fail(res,405,'Method not allowed');
  if(!sourceOK(req))return fail(res,403,'يجب إرسال الطلب من موقع Civil AI.');
  if(Number(req.headers['content-length']||0)>5000)return fail(res,413,'طلب كبير للغاية.');
  if(!process.env.BLOB_READ_WRITE_TOKEN||!process.env.CIVIL_AI_AUTH_SECRET)return fail(res,503,'خدمة الحسابات غير جاهزة.');
  const action=new URL(req.url,'https://civil-ai.invalid').searchParams.get('action');
  if(action!=='request'&&action!=='confirm')return fail(res,404,'Unknown action');
  if(!ipOK(req,action))return fail(res,429,'طلبات كثيرة؛ حاول مجددًا بعد عشر دقائق.');
  const body=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
  const email=norm(body.email);
  if(!emailOK(email))return fail(res,400,'أدخل عنوان بريد إلكتروني صحيحًا.');
  const id=accountId(email),userPath='civilai/users/'+id+'.json';
  const resetPath='civilai/password-reset/tokens/'+id+'.json';
  if(action==='request'){
   // Show an explicit not-configured message; never pretend a code was delivered.
   if(!process.env.RESEND_API_KEY||!process.env.CIVIL_AI_EMAIL_FROM)
     return fail(res,503,'إرسال رموز الاستعادة غير مفعّل بعد. يحتاج الموقع إلى ربط بريد الإرسال من المالك.');
   const existing=await read(userPath);
   if(!existing)return res.status(200).json({message:generic});
   // Immutable rate-limit slot protects against repeated sends across serverless instances.
   const windowId=Math.floor(Date.now()/COOLDOWN_MS);
   const slotPath='civilai/password-reset/slots/'+id+'/'+windowId+'.json';
   try{await write(slotPath,{createdAt:Date.now()})}
   catch(e){if(/already|conflict|409|BlobAlreadyExists/i.test(String(e.message||e.name)))return res.status(200).json({message:generic});throw e}
   const code=String(crypto.randomInt(0,100000000)).padStart(8,'0');
   const salt=crypto.randomBytes(16).toString('hex');
   const reset={salt,digest:codeDigest(id,salt,code),expiresAt:Date.now()+TTL_MS,attempts:0,used:false};
   await write(resetPath,reset,{allowOverwrite:true});
   try{await send(email,code)}
   catch(e){
    console.error('Civil AI mail delivery:',String(e.message||'').slice(0,140));
    // Clear unsuccessful issue attempt so a later configured provider can be retried.
    await Promise.allSettled([del(resetPath),del(slotPath)]);
    return fail(res,503,'تعذر إرسال البريد الآن. تحقق من إعدادات مزود البريد، ثم حاول لاحقًا.');
   }
   return res.status(200).json({message:generic});
  }
  const code=String(body.code||'').trim();
  const newPassword=String(body.newPassword||'');
  if(!/^\d{8}$/.test(code)||newPassword.length<6||newPassword.length>128)
   return fail(res,400,'أدخل رمزًا من 8 أرقام وكلمة مرور جديدة من 6 إلى 128 حرفًا.');
  const [existing,record]=await Promise.all([read(userPath),read(resetPath)]);
  if(!existing||!record||record.value.used||record.value.expiresAt<Date.now()||record.value.attempts>=MAX_ATTEMPTS)
   return fail(res,400,'الرمز غير صحيح أو انتهت صلاحيته. اطلب رمزًا جديدًا.');
  const good=same(record.value.digest,codeDigest(id,record.value.salt,code));
  // Persist an attempt before accepting the code; atomic ETag check limits concurrent guessing.
  const updated={...record.value,attempts:record.value.attempts+1,used:good};
  try{await write(resetPath,updated,{allowOverwrite:true,ifMatch:record.etag})}
  catch(e){if(/Precondition|412/i.test(String(e.name||'')+' '+String(e.message||'')))
    return fail(res,409,'جرى تحديث طلب الاستعادة؛ انتظر قليلًا ثم حاول مجددًا.');throw e}
  if(!good)return fail(res,400,'الرمز غير صحيح أو انتهت صلاحيته. اطلب رمزًا جديدًا.');
  const salt=crypto.randomBytes(16).toString('hex');
  const passwordHash=await passwordHash(newPassword,salt);
  const user={...existing.value,salt,passwordHash,sessionVersion:crypto.randomBytes(16).toString('hex'),passwordChangedAt:new Date().toISOString()};
  try{await write(userPath,user,{allowOverwrite:true,ifMatch:existing.etag})}
  catch(e){return fail(res,409,'تعذر إتمام التحديث بسبب تعديل آخر للحساب. اطلب رمزًا جديدًا.')}
  // Clear current browser session; old signed sessions are invalidated by sessionVersion.
  res.setHeader('Set-Cookie','civilai_user_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  return res.status(200).json({ok:true,message:'تم تغيير كلمة المرور. يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.'});
 }catch(e){
  console.error('Civil AI password recovery:',String(e?.name||'Error'));
  return fail(res,500,'حدث خطأ أثناء الاستعادة، حاول مرة أخرى لاحقًا.');
 }
};