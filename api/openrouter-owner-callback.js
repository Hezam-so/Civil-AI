/* OpenRouter owner-only OAuth callback. The 256-bit random state maps to
 * a short-lived encrypted server-side PKCE verifier. No browser session needed. */
'use strict';
const crypto=require('node:crypto');
const oauth=require('./civil-openrouter-oauth');
const ownerId=crypto.createHash('sha256').update('civilai:global-openrouter:owner').digest('hex');

module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store,private');
 res.setHeader('Referrer-Policy','no-referrer');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'");
 const done=outcome=>{
  res.statusCode=303;
  res.setHeader('Location','/owner-openrouter.html?status='+outcome);
  res.end();
 };
 if(req.method!=='GET'){res.status(405).end();return}
 const url=new URL(req.url,'https://civilai2026.vercel.app');
 const state=url.searchParams.get('state');
 const code=url.searchParams.get('code');
 if(url.searchParams.has('error')||!state||!code)return done('denied');
 try{
  await oauth.finish(ownerId,state,code);
  return done('connected');
 }catch(e){
  // Do not log codes, keys, pending verifier or callback URL.
  console.warn('Civil AI OpenRouter callback failed',e.status||e.name||'error');
  return done('failed');
 }
};
