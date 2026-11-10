/* Civil AI external LLM transport. Keys remain server-side in Vercel environment.
 * Only $0 OpenRouter model IDs are allowed; no automatic paid fallback.
 * All actual site actions are validated by api/assistant.js and need client consent. */
'use strict';

const gatewayToken=req=>process.env.AI_GATEWAY_API_KEY||
  req?.headers?.['x-vercel-oidc-token']||process.env.VERCEL_OIDC_TOKEN;

const freeModel=()=>{
 const configured=String(process.env.CIVIL_AI_OPENROUTER_MODEL||'').trim();
 if(configured==='openrouter/free'||/^[a-z0-9][a-z0-9._-]*\/[a-z0-9._:-]+:free$/i.test(configured))return configured;
 return 'openrouter/free';
};
const openRouterReady=req=>!!(req?.civilOpenRouterKey||process.env.OPENROUTER_API_KEY);
const gatewayReady=req=>!!gatewayToken(req);
const preferred=req=>openRouterReady(req)?'openrouter':gatewayReady(req)?'vercel':null;
const gatewayModel='inclusionai/ling-3.0-tiny-free';
const status=req=>({
  available:!!preferred(req),configuredProvider:preferred(req),
  openrouterConfigured:openRouterReady(req),gatewayConfigured:gatewayReady(req),
  providerVerified:false,
  model:openRouterReady(req)?freeModel():gatewayReady(req)?gatewayModel:null,
  message:openRouterReady(req)?'خدمة OpenRouter مهيأة، ويُختبر عملها عند إرسال سؤال':
    gatewayReady(req)?'اتصال Vercel AI Gateway مهيأ لكنه غير مؤكد':
    'لا يوجد مفتاح نموذج خارجي؛ الحاسبات والمساعد المحلي يعملان'
});
async function completion(messages,tools,req){
 const provider=preferred(req);
 if(!provider)throw Object.assign(Error('النموذج الخارجي غير مهيأ'),{provider:'none',providerStatus:0});
 const openrouter=provider==='openrouter',model=openrouter?freeModel():gatewayModel;
 const endpoint=openrouter?'https://openrouter.ai/api/v1/chat/completions':'https://ai-gateway.vercel.sh/v1/chat/completions';
 const token=openrouter?(req?.civilOpenRouterKey||process.env.OPENROUTER_API_KEY):gatewayToken(req);
 const headers={'Content-Type':'application/json',Authorization:'Bearer '+token};
 if(openrouter){headers['HTTP-Referer']='https://civilai2026.vercel.app';headers['X-Title']='Civil AI Engineering Assistant';}
 const body={model,messages,tools,tool_choice:'auto',max_completion_tokens:2048};
 let response;
 try{response=await fetch(endpoint,{method:'POST',headers,signal:AbortSignal.timeout(29000),body:JSON.stringify(body)});}
 catch(e){throw Object.assign(Error('تعذر الاتصال بالنموذج الخارجي'),{provider,providerStatus:0,causeType:String(e.name||'NetworkError')});}
 if(openrouter&&response.status===400&&tools?.length&&!messages.some(m=>m.role==='tool')){
   // Some free routes do not support function calling. Retry text only so general questions still work.
   const retry=await fetch(endpoint,{method:'POST',headers,signal:AbortSignal.timeout(22000),
     body:JSON.stringify({model,messages,max_completion_tokens:2048})});
   response=retry;
 }
 if(!response.ok){
   // Never log keys, prompts, user data, or provider response bodies.
   console.warn('Civil AI cloud unavailable',provider,response.status);
   throw Object.assign(Error('تعذر الاتصال بمزوّد النموذج الخارجي'),{provider,providerStatus:response.status});
 }
 let data;
 try{data=await response.json();}catch{throw Object.assign(Error('استجابة النموذج غير صالحة'),{provider,providerStatus:502});}
 const message=data.choices?.[0]?.message;
 if(!message||(!message.content&&!message.tool_calls?.length))
  throw Object.assign(Error('لم يرجع النموذج إجابة'),{provider,providerStatus:502});
 return {message,provider,model:data.model||model};
}
module.exports={completion,status,preferred,freeModel};
