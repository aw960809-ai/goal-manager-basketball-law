(function(root){
  'use strict';
  const stateApi=root.GMBState || (typeof require==='function'?require('../core/state.js'):null);
  const logsApi=root.GMBStudyLogs || (typeof require==='function'?require('../domain/study-logs.js'):null);
  function elapsedMs(timer,now=Date.now()){const base=Math.max(0,Number(timer?.elapsedMs)||0);if(timer?.status!=='running'||!timer.startedAt)return base;return base+Math.max(0,now-new Date(timer.startedAt).getTime())}
  function start(state,{mode='free',actionId=null,label='自由計時'},now=Date.now()){
    if(state.timer?.status==='running')throw new Error('計時器已在執行');
    const next=stateApi.clone(state);next.timer={status:'running',mode:mode==='goal'?'goal':'free',actionId:mode==='goal'&&actionId?String(actionId):null,label:String(label||'自由計時'),startedAt:new Date(now).toISOString(),elapsedMs:state.timer?.status==='paused'?Math.max(0,Number(state.timer.elapsedMs)||0):0};return next;
  }
  function pause(state,now=Date.now()){if(state.timer?.status!=='running')return stateApi.clone(state);const next=stateApi.clone(state);next.timer.elapsedMs=elapsedMs(next.timer,now);next.timer.status='paused';next.timer.startedAt=null;return next}
  function resume(state,now=Date.now()){if(state.timer?.status!=='paused')return stateApi.clone(state);const next=stateApi.clone(state);next.timer.status='running';next.timer.startedAt=new Date(now).toISOString();return next}
  function cancel(state){const next=stateApi.clone(state);next.timer=stateApi.idleTimer();return next}
  function complete(state,now=Date.now()){
    const ms=elapsedMs(state.timer,now);if(ms<1000)throw new Error('計時時間太短');
    const r=logsApi.append(state,{kind:state.timer.mode==='goal'?'goal-study':'other-study',actionId:state.timer.actionId||null,label:state.timer.label||'自由計時',durationSeconds:Math.max(1,Math.round(ms/1000)),startedAt:state.timer.startedAt||null,endedAt:new Date(now).toISOString(),source:'timer'},now);
    r.state.timer=stateApi.idleTimer();return r;
  }
  const api={elapsedMs,start,pause,resume,cancel,complete};
  root.GMBTimer=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
