(function(root){
  'use strict';
  const stateApi=root.GMBState || (typeof require==='function'?require('../core/state.js'):null);
  function id(prefix){return prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8)}
  function byId(state,goalId){return (state.goals||[]).find(g=>String(g.id)===String(goalId))||null}
  function children(state,parentId){return (state.goals||[]).filter(g=>String(g.parentId||'')===String(parentId||''))}
  function roots(state){return (state.goals||[]).filter(g=>Number(g.level)===1&&g.status!=='archived')}
  function descendants(state,goalId){const out=[];const queue=[goalId];while(queue.length){const x=queue.shift();for(const c of children(state,x)){out.push(c);queue.push(c.id)}}return out}
  function ancestors(state,goalId){const out=[];let cur=byId(state,goalId),guard=0;while(cur&&guard++<8){out.unshift(cur);cur=cur.parentId?byId(state,cur.parentId):null}return out}
  function pathText(state,goalId){return ancestors(state,goalId).map(g=>g.name).join(' → ')}
  function cleanDate(v){const s=String(v||'').trim();return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:''}

  function addGoal(state,{name,level,parentId=null,targetDate=''}){
    const next=stateApi.clone(state),n=String(name||'').trim(),l=Number(level);
    if(!n)throw new Error('目標名稱不可空白');
    if(![1,2,3].includes(l))throw new Error('只允許三層目標');
    if(l===1)parentId=null;
    if(l>1){const p=byId(next,parentId);if(!p||Number(p.level)!==l-1)throw new Error('上層目標不正確')}
    next.goals.push({id:id('g'+l),level:l,parentId,name:n,targetDate:cleanDate(targetDate),status:'active',createdAt:new Date().toISOString(),completedAt:null});
    return next;
  }
  function createPath(state,{direction,milestone,action}){
    let next=addGoal(state,{name:direction,level:1});const rootGoal=next.goals[next.goals.length-1];
    next=addGoal(next,{name:milestone,level:2,parentId:rootGoal.id});const stage=next.goals[next.goals.length-1];
    return addGoal(next,{name:action,level:3,parentId:stage.id});
  }
  function updateGoal(state,goalId,{name,targetDate}){
    const next=stateApi.clone(state),g=byId(next,goalId);if(!g)throw new Error('找不到目標');
    const n=String(name??g.name).trim();if(!n)throw new Error('目標名稱不可空白');
    g.name=n;g.targetDate=cleanDate(targetDate??g.targetDate);return next;
  }
  function setCompleted(state,goalId,done){
    const next=stateApi.clone(state),g=byId(next,goalId);if(!g||Number(g.level)!==3)throw new Error('只有具體行動可直接完成');
    g.status=done?'done':'active';g.completedAt=done?new Date().toISOString():null;return next;
  }
  function removeGoal(state,goalId){
    const next=stateApi.clone(state),removeIds=new Set([String(goalId),...descendants(next,goalId).map(g=>String(g.id))]);
    next.goals=next.goals.filter(g=>!removeIds.has(String(g.id)));
    next.studyLogs=(next.studyLogs||[]).map(log=>removeIds.has(String(log.actionId||''))?{...log,actionId:null,orphaned:true}:log);
    if(removeIds.has(String(next.timer?.actionId||'')))next.timer=stateApi.idleTimer();
    return next;
  }
  function actions(state){return (state.goals||[]).filter(g=>Number(g.level)===3&&g.status!=='archived')}
  function progress(state,goalId){
    const g=byId(state,goalId);if(!g)return 0;const list=Number(g.level)===3?[g]:descendants(state,goalId).filter(x=>Number(x.level)===3&&x.status!=='archived');
    if(!list.length)return 0;return Math.round(list.filter(x=>x.status==='done').length/list.length*100);
  }
  function nextAction(state){
    return actions(state).filter(a=>a.status!=='done').sort((a,b)=>{
      const ad=a.targetDate||'9999-12-31',bd=b.targetDate||'9999-12-31';
      return ad.localeCompare(bd)||String(a.createdAt||'').localeCompare(String(b.createdAt||''));
    })[0]||null;
  }
  function datedGoals(state,fromDate='0000-00-00'){
    return (state.goals||[]).filter(g=>g.status!=='archived'&&g.targetDate&&g.targetDate>=fromDate).sort((a,b)=>a.targetDate.localeCompare(b.targetDate));
  }
  const api={byId,children,roots,descendants,ancestors,pathText,addGoal,createPath,updateGoal,setCompleted,removeGoal,actions,progress,nextAction,datedGoals};
  root.GMBGoals=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
