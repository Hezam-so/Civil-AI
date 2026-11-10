/* Civil AI: per-account OpenRouter OAuth PKCE credential vault.
 * Tokens encrypted at rest in the private Vercel Blob store.
 * Does not create paid models or make credentials available to browser scripts. */
'use strict';
const crypto=require('node:crypto');
const {get,put,del}=require('@vercel/blob');
const pathFor=id=>{
 if(!/^[a-f0-9]{64}$/.test(String(id)))throw Error('Invalid account identifier');
 return 'civilai/keys/openrouter/'+id+'.json';
};
function vaultKey(){
 const secret=process.env.CIVIL_AI_AUTH_SECRET;
 if(!secret||secret.length<24)throw Error('Account security secret is not configured');
 return crypto.createHash('sha256').update('civil-ai:openrouter-oauth:v1:'+secret).digest();
}
const encrypt=(value)=>{
 const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',vaultKey(),iv);
 const payload=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
 return JSON.stringify({v:1,iv:iv.toString('base64url'),data:payload.toString('base64url'),tag:cipher.getAuthTag().toString('base64url')});
};
const decrypt=(body)=>{
 const j=JSON.parse(body);
 if(j.v!==1||typeof j.iv!=='string'||typeof j.data!=='string'||typeof j.tag!=='string')throw Error('Invalid vault record');
 const decipher=crypto.createDecipheriv('aes-256-gcm',vaultKey(),Buffer.from(j.iv,'base64url'));
 decipher.setAuthTag(Buffer.from(j.tag,'base64url'));
 return Buffer.concat([decipher.update(Buffer.from(j.data,'base64url')),decipher.final()]).toString('utf8');
};
async function load(userId){
 const item=await get(pathFor(userId),{access:'private'});
 if(!item?.stream)return null;
 const body=await new Response(item.stream).text();
 const key=decrypt(body);
 if(!/^sk-or-[\w-]{18,}$/.test(key))throw Error('Saved key is invalid');
 return key;
}
async function connect(userId,code,verifier){
 const authCode=String(code||''),check=String(verifier||'');
 if(authCode.length<8||authCode.length>2048||!/^[\w.-]+$/.test(authCode))throw Object.assign(Error('رمز OpenRouter غير صالح.'),{status:400});
 if(check.length<43||check.length>128||!/^[a-zA-Z0-9_-]+$/.test(check))throw Object.assign(Error('جلسة ربط OpenRouter غير صالحة.'),{status:400});
 let response;
 try{
  response=await fetch('https://openrouter.ai/api/v1/auth/keys',{
   method:'POST',
   headers:{'Content-Type':'application/json'},
   signal:AbortSignal.timeout(18000),
   body:JSON.stringify({code:authCode,code_verifier:check,code_challenge_method:'S256'})
  });
 }catch{throw Object.assign(Error('تعذر الاتصال بـ OpenRouter أثناء التفويض.'),{status:502})}
 if(!response.ok){
  console.warn('Civil AI OpenRouter OAuth exchange failed',response.status);
  throw Object.assign(Error('رفض OpenRouter إتمام التفويض ('+response.status+'). أعد المحاولة من زر الربط.'),{status:502});
 }
 const result=await response.json().catch(()=>({}));
 const key=String(result.key||'');
 if(!/^sk-or-[\w-]{18,}$/.test(key))throw Object.assign(Error('لم يرسل OpenRouter مفتاحًا صالحًا.'),{status:502});
 await put(pathFor(userId),encrypt(key),{
  access:'private',addRandomSuffix:false,allowOverwrite:true,
  contentType:'application/json',cacheControlMaxAge:60
 });
 return {connected:true};
}
async function disconnect(userId){
 const file=await get(pathFor(userId),{access:'private'});
 if(file?.url)await del(file.url);
 return {connected:false};
}
module.exports={load,connect,disconnect};
