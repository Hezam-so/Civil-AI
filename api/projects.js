'use strict';
const crypto=require('node:crypto');
const {put,get,list,del}=require('@vercel/blob');
const COOKIE='civilai_user_session';
function uid(req){
 try{
 const raw=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='));
 if(!raw)return null;
 const [id,exp,mac]=raw.slice(COOKIE.length+1).split('.');
 if(!/^[a-f0-9]{64}$/.test(id)||!/^\d{10}$/.test(exp)||!mac)return null;
 const now=Math.floor(Date.now()/1000);
 if(+exp<now||+exp>now+14*86400+60)return null;
 const expected=crypto.createHmac('sha256',process.env.CIVIL_AI_AUTH_SECRET).update(id+'.'+exp).digest('base64url');
 const a=Buffer.from(expected),b=Buffer.from(mac);
 return a.length===b.length&&crypto.timingSafeEqual(a,b)?id:null;
 }catch{return null}
}
const fail=(res,code,error)=>res.status(code).json({error});
async function read(path){const b=await get(path,{access:'private'});return b?.stream?JSON.parse(await new Response(b.stream).text()):null}
module.exports=async function(req,res){
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 try{
 if(!process.env.CIVIL_AI_AUTH_SECRET||!process.env.BLOB_READ_WRITE_TOKEN)return fail(res,503,'خدمة الحفظ غير مهيأة.');
 const id=uid(req);if(!id)return fail(res,401,'يلزم تسجيل الدخول إلى حسابك.');
 const u=await read('civilai/users/'+id+'.json');if(!u)return fail(res,401,'الحساب غير موجود.');
 const origin=req.headers.origin,host=req.headers['x-forwarded-host']||req.headers.host;
 if(req.method!=='GET'&&origin!=='https://'+host)return fail(res,403,'Invalid request origin');
 const key='civilai/projects/'+id+'/';
 const url=new URL(req.url,'https://civilai.invalid'),act=url.searchParams.get('action');
 if(req.method==='GET'&&act==='list'){
  const all=[];let cursor=undefined;
  do{
   const result=await list({prefix:key,limit:100,cursor});
   for(const item of result.blobs){if(item.pathname.endsWith('.json'))all.push(item.pathname)}
   cursor=result.hasMore?result.cursor:undefined;
  }while(cursor&&all.length<250);
  const values=(await Promise.all(all.slice(0,250).map(read))).filter(Boolean);
  values.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  return res.status(200).json({projects:values.map(({id,title,type,createdAt,data})=>({id,title,type,createdAt,data})),truncated:all.length>=250});
 }
 if(req.method==='POST'&&act==='create'){
  const length=Number(req.headers['content-length']||0);
  if(length>128000)return fail(res,413,'حجم بيانات المشروع كبير. الحد 120KB.');
  const b=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
  const title=String(b.title||'مشروع جديد').trim().slice(0,120);
  const type=String(b.type||'calculation').trim().slice(0,40);
  const data=b.data;
  if(!title||!data||typeof data!=='object'||Array.isArray(data))return fail(res,400,'اسم المشروع أو بياناته غير صالحة.');
  const project={id:crypto.randomUUID(),owner:id,title,type,createdAt:new Date().toISOString(),data};
  const content=JSON.stringify(project);
  if(Buffer.byteLength(content)>120000)return fail(res,413,'بيانات المشروع تتجاوز 120KB.');
  await put(key+project.id+'.json',content,{access:'private',contentType:'application/json',addRandomSuffix:false,cacheControlMaxAge:60});
  return res.status(201).json({project:{id:project.id,title,type,createdAt:project.createdAt,data}});
 }
 if(req.method==='POST'&&act==='delete'){
  const b=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
  if(!/^[a-f0-9-]{36}$/.test(String(b.id||'')))return fail(res,400,'Invalid project ID');
  await del(key+b.id+'.json');
  return res.status(200).json({ok:true});
 }
 return fail(res,405,'Unknown action');
 }catch(e){console.error('Civil AI projects',e?.name||'Error',String(e?.message||'').slice(0,160));return fail(res,500,'تعذر قراءة أو حفظ المشروع. حاول مرة أخرى.')}
};
