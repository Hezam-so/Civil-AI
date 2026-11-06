'use strict';
const crypto=require('node:crypto');
const {put,get,list,del}=require('@vercel/blob');
const COOKIE='civilai_user_session';
const TTL=14*86400;
const maxBytes=120000;
const attempts=new Map();
function permitAttempt(req,action){
 const ip=String(req.headers['x-real-ip']||req.headers['x-forwarded-for']||'unknown').split(',')[0].trim().slice(0,65);
 const key=action+':'+ip,now=Date.now(),entry=attempts.get(key);
 const ceiling=action==='register'?5:action==='check-email'?5:12;
 if(entry&&entry.end>now){
  if(entry.count>=ceiling)return false;
  entry.count++;return true;
 }
 attempts.set(key,{count:1,end:now+10*60*1000});
 if(attempts.size>5000)attempts.clear();
 return true;
}
const readJson=async(path)=>{
 const b=await get(path,{access:'private'});
 if(!b||!b.stream)return null;
 const data=await new Response(b.stream).text();
 return JSON.parse(data);
};
const jsonPut=(path,value)=>put(path,JSON.stringify(value),{access:'private',contentType:'application/json',addRandomSuffix:false,cacheControlMaxAge:60});
const toId=(email)=>crypto.createHash('sha256').update(email).digest('hex');
const sign=(s)=>crypto.createHmac('sha256',process.env.CIVIL_AI_AUTH_SECRET).update(s).digest('base64url');
const normEmail=(e)=>String(e||'').trim().toLowerCase();
const invalid= (res,status,message)=>res.status(status).json({error:message});
const safe=(req)=>{
 const origin=req.headers.origin;const host=req.headers['x-forwarded-host']||req.headers.host;
 return typeof origin==='string'&&origin==='https://'+host;
};
function current(req){
 try{
 const raw=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='));
 if(!raw)return null;
 const value=raw.slice(COOKIE.length+1),parts=value.split('.');
 if(parts.length!==3&&parts.length!==4)return null;
 const [id,exp,versionOrMac,signature]=parts;
 const version=parts.length===4?versionOrMac:null;
 const mac=signature||versionOrMac;
 if(version&&!/^[a-f0-9]{32}$/.test(version))return null;
 if(!/^[a-f0-9]{64}$/.test(id)||!/^\d{10}$/.test(exp))return null;
 const expTime=Number(exp);
 if(expTime<Math.floor(Date.now()/1000)||expTime>Math.floor(Date.now()/1000)+TTL+60)return null;
 const expected=Buffer.from(sign(id+'.'+exp+(version?'.'+version:''))),provided=Buffer.from(mac);
 if(expected.length!==provided.length||!crypto.timingSafeEqual(expected,provided))return null;
 return {id,version};
 }catch{return null}
}
function setCookie(res,id,version){
 const expiry=Math.floor(Date.now()/1000)+TTL;
 const data=id+'.'+expiry+(version?'.'+version:'');
 const token=data+'.'+sign(data);
 res.setHeader('Set-Cookie',COOKIE+'='+token+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age='+TTL);
}
function clearCookie(res){res.setHeader('Set-Cookie',COOKIE+'=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0')}
async function hash(pass,salt){
 return await new Promise((resolve,reject)=>crypto.scrypt(pass,salt,64,{N:16384,r:8,p:1},(e,b)=>e?reject(e):resolve(b.toString('hex'))));
}
function parse(req){return typeof req.body==='string'?JSON.parse(req.body):req.body||{}}
function publicUser(u){return {name:u.name,email:u.email,createdAt:u.createdAt}}
module.exports=async function(req,res){
 res.setHeader('Cache-Control','no-store, private');
 res.setHeader('X-Content-Type-Options','nosniff');
 try{
 if(!process.env.BLOB_READ_WRITE_TOKEN||!process.env.CIVIL_AI_AUTH_SECRET)return invalid(res,503,'خدمة الحسابات قيد الإعداد.');
 if(!['GET','POST','DELETE'].includes(req.method))return invalid(res,405,'Method not allowed');
 const action=new URL(req.url,'https://civilai.invalid').searchParams.get('action');
 if(req.method==='GET'&&action==='session'){
   const session=current(req);
   if(!session)return res.status(200).json({authenticated:false});
   const u=await readJson('civilai/users/'+session.id+'.json');
   const valid=Boolean(u&&((u.sessionVersion||null)===session.version));
   return res.status(200).json({authenticated:valid,user:valid?publicUser(u):null});
 }
 if(req.method!=='POST'||!safe(req))return invalid(res,403,'يجب تنفيذ العملية من الموقع الأصلي.');
 if(req.headers['content-length']&&Number(req.headers['content-length'])>maxBytes)return invalid(res,413,'Request too large');
 const b=parse(req);
 if(action==='logout'){clearCookie(res);return res.status(200).json({authenticated:false})}
 if(action==='check-email'){
   if(!permitAttempt(req,action))return invalid(res,429,'طلبات فحص كثيرة. حاول بعد عشر دقائق.');
   const email=normEmail(b.email);
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return invalid(res,400,'أدخل بريدًا إلكترونيًا صحيحًا.');
   const user=await readJson('civilai/users/'+toId(email)+'.json');
   // Status lookup is user-initiated and throttled. Never include private account details.
   return res.status(200).json({registered:Boolean(user),message:user?'هذا البريد مسجّل في Civil AI.':'هذا البريد غير مسجّل في Civil AI.'});
 }
 if(action!=='register'&&action!=='login')return invalid(res,404,'Unknown action');
 if(!permitAttempt(req,action))return invalid(res,429,'محاولات كثيرة. جرّب بعد عشر دقائق.');
 const email=normEmail(b.email),password=String(b.password||'');
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return invalid(res,400,'أدخل عنوان بريد إلكتروني صحيحًا.');
 if(password.length>(128)||password.length<(action==='register'?8:6))
   return invalid(res,400,action==='register'?'كلمة مرور الحساب الجديد يجب أن تتكون من 8 إلى 128 حرفًا أو رقمًا.':'البريد الإلكتروني أو كلمة المرور غير صحيحة.');
 const id=toId(email),path='civilai/users/'+id+'.json';
 if(action==='register'){
   const name=String(b.name||'').trim().slice(0,90);
   if(name.length<2)return invalid(res,400,'أدخل الاسم (حرفان على الأقل).');
   const salt=crypto.randomBytes(16).toString('hex');
   const user={id,email,name,salt,passwordHash:await hash(password,salt),sessionVersion:crypto.randomBytes(16).toString('hex'),createdAt:new Date().toISOString()};
   try{await jsonPut(path,user)}
   catch(e){if(e?.name==='BlobAlreadyExistsError'||/already exist|409|conflict/i.test(e?.message||''))return invalid(res,409,'هذا البريد مسجّل مسبقًا، سجّل دخولك.');throw e}
   setCookie(res,id,user.sessionVersion);
   return res.status(201).json({authenticated:true,user:publicUser(user)});
 }
 const u=await readJson(path);
 // Verify a dummy hash for nonexistent accounts to reduce timing differences.
 const salt=u?.salt||'00000000000000000000000000000000';
 const candidate=await hash(password,salt),expected=u?.passwordHash||'0'.repeat(128);
 if(!u||!crypto.timingSafeEqual(Buffer.from(candidate,'hex'),Buffer.from(expected,'hex')))return invalid(res,401,'البريد الإلكتروني أو كلمة المرور غير صحيحة.');
 setCookie(res,id,u.sessionVersion);
 return res.status(200).json({authenticated:true,user:publicUser(u)});
 }catch(e){console.error('Civil AI auth',e?.name||'Error',String(e?.message||'').slice(0,150));return invalid(res,500,'تعذر إتمام الطلب الآن. جرّب لاحقًا.')}
};
