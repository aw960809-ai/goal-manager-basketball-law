(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.GMBReview=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const ACTIONS=Object.freeze(['approve','exclude','pending']);
  const str=v=>String(v??'').trim();
  const clone=v=>JSON.parse(JSON.stringify(v??{}));
  const key=(kind,id)=>`${kind}:${str(id)}`;
  function normalize(input){
    const src=input&&typeof input==='object'?input:{};const out={};
    for(const [k,v] of Object.entries(src)){
      if(!v||typeof v!=='object'||!ACTIONS.includes(v.action))continue;
      const [kind,...rest]=String(k).split(':'),id=rest.join(':');
      if(!['activity','scholarship'].includes(kind)||!id)continue;
      out[k]={kind,id,action:v.action,note:str(v.note),title:str(v.title),updatedAt:str(v.updatedAt)||new Date(0).toISOString()};
    }
    return out;
  }
  function get(input,kind,id){return normalize(input)[key(kind,id)]||null}
  function set(input,{kind,id,action='pending',note='',title=''}={}){
    if(!['activity','scholarship'].includes(kind)||!str(id))throw new Error('review target invalid');
    const out=normalize(input),k=key(kind,id);
    if(action==='auto'||action==='reset'){delete out[k];return out}
    if(!ACTIONS.includes(action))throw new Error('review action invalid');
    out[k]={kind,id:str(id),action,note:str(note),title:str(title),updatedAt:new Date().toISOString()};
    return out;
  }
  function stats(input){
    const rows=Object.values(normalize(input)),out={total:rows.length,approve:0,exclude:0,pending:0,activity:0,scholarship:0};
    rows.forEach(x=>{out[x.action]=(out[x.action]||0)+1;out[x.kind]=(out[x.kind]||0)+1});return out;
  }
  function markApproved(row,kind,decision){
    const fit={...(row.fit||{}),reasons:[`人工審查核准${decision.note?`：${decision.note}`:''}`,...((row.fit?.reasons)||[])]};
    if(kind==='activity')return {...row,qualityBucket:'candidate',qualityReason:'人工審查已核准',fit,manualReview:decision};
    return {...row,bucket:'recommended',eligibility:{eligible:true,code:'MANUAL_APPROVED',label:'人工核准',reason:`人工審查已確認可列入推薦${decision.note?`：${decision.note}`:''}`},fit,manualReview:decision};
  }
  function markExcluded(row,kind,decision){
    if(kind==='activity')return {...row,qualityBucket:'manual-excluded',qualityReason:`人工審查排除${decision.note?`：${decision.note}`:''}`,manualReview:decision};
    return {...row,bucket:'excluded',eligibility:{eligible:false,code:'MANUAL_EXCLUDED',label:'人工排除',reason:`人工審查排除${decision.note?`：${decision.note}`:''}`},manualReview:decision};
  }
  const scoreSort=(a,b)=>(Number(b.fit?.score)||0)-(Number(a.fit?.score)||0)||String(a.title||'').localeCompare(String(b.title||''),'zh-Hant');
  function applyActivity(catalog,input){
    const c=catalog&&typeof catalog==='object'?catalog:{},decisions=normalize(input),recommended=[...(c.recommended||[])],review=[],manualExcluded=[];
    for(const row of c.review||[]){
      const d=decisions[key('activity',row.id)];
      if(d?.action==='approve')recommended.push(markApproved(row,'activity',d));
      else if(d?.action==='exclude')manualExcluded.push(markExcluded(row,'activity',d));
      else review.push(d?{...row,manualReview:d}:row);
    }
    return {...c,recommended:recommended.sort(scoreSort),review,manualExcluded,reviewDecisions:decisions};
  }
  function applyScholarship(catalog,input){
    const c=catalog&&typeof catalog==='object'?catalog:{},decisions=normalize(input),recommended=[...(c.recommended||[])],review=[],excluded=[...(c.excluded||[])];
    for(const row of c.review||[]){
      const d=decisions[key('scholarship',row.id)];
      if(d?.action==='approve')recommended.push(markApproved(row,'scholarship',d));
      else if(d?.action==='exclude')excluded.push(markExcluded(row,'scholarship',d));
      else review.push(d?{...row,manualReview:d}:row);
    }
    return {...c,recommended:recommended.sort(scoreSort),review,excluded,reviewDecisions:decisions};
  }
  function exportPayload(input){return {schemaVersion:1,productId:'gmb-law',exportedAt:new Date().toISOString(),decisions:normalize(input)}}
  function importPayload(payload){
    if(!payload||typeof payload!=='object')throw new Error('審查檔案格式不正確');
    return normalize(payload.decisions||payload);
  }
  return Object.freeze({ACTIONS,key,normalize,get,set,stats,applyActivity,applyScholarship,exportPayload,importPayload});
});
