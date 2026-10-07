(function(root){
  'use strict';
  const stateApi=root.GMBState || (typeof require==='function'?require('../core/state.js'):null);
  function id(now=Date.now()){return 'log-'+Number(now).toString(36)+'-'+Math.random().toString(36).slice(2,7)}
  function actionFor(state,actionId){return (state.goals||[]).find(g=>String(g.id)===String(actionId)&&Number(g.level)===3)||null}
  function create(state,{kind='other-study',actionId=null,label='學習紀錄',durationSeconds,startedAt=null,endedAt=null,source='timer'},now=Date.now()){
    const seconds=Math.max(1,Math.round(Number(durationSeconds)||0));if(!(seconds>0))throw new Error('時間必須大於 0');
    const isGoal=kind==='goal-study';
    if(isGoal&&!actionFor(state,actionId))throw new Error('具體行動不存在');
    const end=endedAt?new Date(endedAt):new Date(now);if(Number.isNaN(end.getTime()))throw new Error('紀錄日期不正確');
    const start=startedAt?new Date(startedAt):new Date(end.getTime()-seconds*1000);
    return {id:id(now),kind:isGoal?'goal-study':'other-study',actionId:isGoal?String(actionId):null,label:String(label||'').trim()||'學習紀錄',durationSeconds:seconds,source:source==='manual'?'manual':'timer',startedAt:start.toISOString(),endedAt:end.toISOString(),createdAt:new Date(now).toISOString(),orphaned:false};
  }
  function append(state,spec,now=Date.now()){const next=stateApi.clone(state);const log=create(next,spec,now);next.studyLogs.push(log);return {state:next,log}}
  function localNoonIso(dateKey){const d=new Date(String(dateKey)+'T12:00:00');if(Number.isNaN(d.getTime()))throw new Error('補登日期不正確');return d.toISOString()}
  function manual(state,{actionId=null,label='',minutes,date},now=Date.now()){
    const mins=Math.round(Number(minutes)||0);if(mins<1||mins>1440)throw new Error('補登分鐘需介於 1～1440');
    const action=actionId?actionFor(state,actionId):null;if(actionId&&!action)throw new Error('補登的具體行動不存在');
    return append(state,{kind:action?'goal-study':'other-study',actionId:action?.id||null,label:String(label||'').trim()||(action?action.name:'其他讀書時間'),durationSeconds:mins*60,endedAt:localNoonIso(date),source:'manual'},now);
  }
  function remove(state,logId){const next=stateApi.clone(state);next.studyLogs=(next.studyLogs||[]).filter(l=>String(l.id)!==String(logId));return next}
  const api={create,append,manual,remove,localNoonIso};
  root.GMBStudyLogs=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
