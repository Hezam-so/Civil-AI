/* Civil AI external inference. Free anonymous Kilo Gateway is the default:
 * no visitor OAuth, API key or paid model is required.
 * Existing OpenRouter credentials (if previously authorized) remain supported.
 * All tool proposals are validated by api/assistant.js and require user approval. */
'use strict';

const FREE_KILO_MODEL='kilo-auto/free';
const KILO_URL='https://ai-gateway.kilo.ai/api/v1/chat/completions';
const freeOpenRouterModel=()=>{
 const configured=String(process.env.CIVIL_AI_OPENROUTER_MODEL||'').trim();
 if(configured==='openrouter/free'||/^[a-z0-9][a-z0-9._-]*\/[a-z0-9._:-]+:free$/i.test(configured))return configured;
 return 'openrouter/free';
};
const hasOpenRouter=req=>!!(req?.civilOpenRouterKey||process.env.OPENROUTER_API_KEY);
const preferred=req=>hasOpenRouter(req)?'openrouter':'kilo';
const status=req=>{
 const provider=preferred(req);
 return {
  available:true,configuredProvider:provider,providerVerified:false,
  openrouterConfigured:hasOpenRouter(req),openrouterLinked:!!req?.civilOpenRouterKey,
  gatewayConfigured:false,model:provider==='openrouter'?freeOpenRouterModel():FREE_KILO_MODEL,
  message:provider==='kilo'
   ?'مساعد خارجي مجاني مباشر (Kilo Gateway)؛ يعمل دون ربط حساب، حسب توفر النماذج وحدود الاستخدام'
   :'مساعد خارجي OpenRouter؛ يتحقق نجاح النموذج عند السؤال'
 };
};
async function completion(messages,tools,req){
 const provider=preferred(req),isRouter=provider==='openrouter';
 const model=isRouter?freeOpenRouterModel():FREE_KILO_MODEL;
 const endpoint=isRouter?'https://openrouter.ai/api/v1/chat/completions':KILO_URL;
 const headers={'Content-Type':'application/json'};
 if(isRouter){
  headers.Authorization='Bearer '+(req?.civilOpenRouterKey||process.env.OPENROUTER_API_KEY);
  headers['HTTP-Referer']='https://civilai2026.vercel.app';
  headers['X-Title']='Civil AI Engineering Assistant';
 }
 const call=async(withTools)=>{
  const body={model,messages,max_tokens:2048};
  if(withTools&&Array.isArray(tools)&&tools.length){body.tools=tools;body.tool_choice='auto';}
  try{
   return await fetch(endpoint,{method:'POST',headers,signal:AbortSignal.timeout(28000),
    body:JSON.stringify(body)});
  }catch(e){
   throw Object.assign(Error('تعذر الاتصال بالنموذج الخارجي'),{provider,providerStatus:0,causeType:String(e?.name||'NetworkError')});
  }
 };
 let response=await call(true);
 // Models in the free pool do not always implement tool calling.
 // Retry without tools only before any tool responses have been added.
 if([400,422].includes(response.status)&&tools?.length&&!messages.some(m=>m.role==='tool'))response=await call(false);
 if(!response.ok){
  console.warn('Civil AI free provider status',provider,response.status);
  throw Object.assign(Error('تعذر الاتصال بمزوّد الذكاء الخارجي'),{provider,providerStatus:response.status});
 }
 let data;
 try{data=await response.json();}catch{throw Object.assign(Error('استجابة المزود غير صالحة'),{provider,providerStatus:502});}
 const message=data?.choices?.[0]?.message;
 if(!message||(!message.content&&!message.tool_calls?.length))
  throw Object.assign(Error('النموذج لم يرجع إجابة'),{provider,providerStatus:502});
 return {message,provider,model:data.model||model};
}
module.exports={completion,status,preferred,freeModel:freeOpenRouterModel,FREE_KILO_MODEL};
