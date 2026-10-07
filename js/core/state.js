(function(root){
  'use strict';
  const config=root.GMB_CONFIG || (typeof require==='function'?require('../../config/app-config.js'):null);

  function nowIso(){return new Date().toISOString();}
  function idleTimer(){return {status:'idle',mode:null,actionId:null,label:'',startedAt:null,elapsedMs:0};}
  function freshState(){
    const now=nowIso();
    return {
      schemaVersion:config.schemaVersion,
      createdAt:now,
      updatedAt:now,
      profile:{institution:config.profile.institution,department:config.profile.department},
      goals:[],
      studyLogs:[],
      personalEvents:[],
      reviewDecisions:{},
      timer:idleTimer(),
      settings:{onboardingComplete:false,appearance:'system',accent:'orange',calendarView:'month'}
    };
  }

  function clone(value){return JSON.parse(JSON.stringify(value));}
  function dateKeyOk(v){return v==null||v===''||/^\d{4}-\d{2}-\d{2}$/.test(String(v));}
  function normalizeTimer(input){
    const x=input&&typeof input==='object'?input:{};
    const status=['idle','running','paused'].includes(x.status)?x.status:'idle';
    if(status==='idle')return idleTimer();
    return {
      status,
      mode:x.mode==='goal'?'goal':'free',
      actionId:x.mode==='goal'&&x.actionId!=null?String(x.actionId):null,
      label:String(x.label||''),
      startedAt:status==='running'&&x.startedAt?String(x.startedAt):null,
      elapsedMs:Math.max(0,Number(x.elapsedMs)||0)
    };
  }
  function normalizeGoal(g){
    const x={...(g||{})};
    return {
      ...x,
      id:String(x.id||''),
      name:String(x.name||'').trim(),
      level:Number(x.level)||0,
      parentId:x.parentId?String(x.parentId):null,
      status:x.status==='done'?'done':(x.status==='archived'?'archived':'active'),
      targetDate:dateKeyOk(x.targetDate)?String(x.targetDate||''):'',
      createdAt:String(x.createdAt||nowIso()),
      completedAt:x.completedAt?String(x.completedAt):null
    };
  }
  function normalizeLog(log){
    const x={...(log||{})};
    return {
      ...x,
      id:String(x.id||''),
      kind:x.kind==='goal-study'?'goal-study':'other-study',
      actionId:x.actionId?String(x.actionId):null,
      label:String(x.label||'').trim()||'學習紀錄',
      durationSeconds:Math.max(0,Math.round(Number(x.durationSeconds)||0)),
      source:x.source==='manual'?'manual':'timer',
      startedAt:x.startedAt?String(x.startedAt):null,
      endedAt:x.endedAt?String(x.endedAt):String(x.createdAt||nowIso()),
      createdAt:String(x.createdAt||nowIso()),
      orphaned:!!x.orphaned
    };
  }

  function normalizeReviewDecisions(input){
    const src=input&&typeof input==='object'?input:{},out={};
    for(const [k,v] of Object.entries(src)){
      if(!v||typeof v!=='object'||!['approve','exclude','pending'].includes(v.action))continue;
      const parts=String(k).split(':'),kind=parts.shift(),id=parts.join(':');
      if(!['activity','scholarship'].includes(kind)||!id)continue;
      out[k]={kind,id,action:v.action,note:String(v.note||'').trim(),title:String(v.title||'').trim(),updatedAt:String(v.updatedAt||'')};
    }
    return out;
  }

  function normalizeEvent(ev){
    const x={...(ev||{})};
    return {id:String(x.id||''),date:String(x.date||''),title:String(x.title||'').trim(),meta:String(x.meta||'個人行事')};
  }

  function validateGoalShape(goals){
    if(!Array.isArray(goals))return ['goals-not-array'];
    const errors=[];const ids=new Set();
    for(const g of goals){
      if(!g||typeof g!=='object'){errors.push('goal-invalid');continue;}
      if(!g.id||ids.has(String(g.id)))errors.push('goal-id-invalid');
      ids.add(String(g.id||''));
      if(![1,2,3].includes(Number(g.level)))errors.push('goal-level-invalid');
      if(!String(g.name||'').trim())errors.push('goal-name-empty');
      if(!dateKeyOk(g.targetDate))errors.push('goal-date-invalid');
    }
    for(const g of goals){
      if(Number(g.level)===1){if(g.parentId)errors.push('root-has-parent');continue;}
      const p=goals.find(x=>String(x.id)===String(g.parentId));
      if(!p)errors.push('goal-parent-missing');
      else if(Number(p.level)!==Number(g.level)-1)errors.push('goal-parent-level-invalid');
    }
    return errors;
  }

  function normalize(input){
    const base=freshState();
    const src=input&&typeof input==='object'?clone(input):{};
    return {
      ...base,
      ...src,
      schemaVersion:config.schemaVersion,
      createdAt:String(src.createdAt||base.createdAt),
      updatedAt:String(src.updatedAt||base.updatedAt),
      profile:{...base.profile,...(src.profile||{})},
      goals:Array.isArray(src.goals)?src.goals.filter(Boolean).map(normalizeGoal):[],
      studyLogs:Array.isArray(src.studyLogs)?src.studyLogs.filter(Boolean).map(normalizeLog):[],
      personalEvents:Array.isArray(src.personalEvents)?src.personalEvents.filter(Boolean).map(normalizeEvent):[],
      reviewDecisions:normalizeReviewDecisions(src.reviewDecisions),
      timer:normalizeTimer(src.timer),
      settings:(()=>{
        const raw={...base.settings,...(src.settings||{})};
        const appearance=['system','dark','light'].includes(raw.appearance)?raw.appearance:'system';
        const accent=['orange','blue','green','purple'].includes(raw.accent)?raw.accent:'orange';
        const calendarView=['month','agenda'].includes(raw.calendarView)?raw.calendarView:'month';
        return {...raw,appearance,accent,calendarView};
      })()
    };
  }

  function validate(state){
    const s=normalize(state);const errors=validateGoalShape(s.goals);
    if(s.profile.institution!==config.profile.institution)errors.push('profile-institution-mismatch');
    if(s.profile.department!==config.profile.department)errors.push('profile-department-mismatch');
    if(!['idle','running','paused'].includes(s.timer.status))errors.push('timer-status-invalid');
    if(s.timer.mode==='goal'&&s.timer.actionId){
      const action=s.goals.find(g=>String(g.id)===String(s.timer.actionId));
      if(!action||Number(action.level)!==3)errors.push('timer-action-invalid');
    }
    const logIds=new Set();
    for(const log of s.studyLogs){
      if(!log.id||logIds.has(log.id))errors.push('log-id-invalid');
      logIds.add(log.id);
      if(!(Number(log.durationSeconds)>0))errors.push('log-duration-invalid');
      if(!['goal-study','other-study'].includes(log.kind))errors.push('log-kind-invalid');
      if(log.kind==='goal-study'&&log.actionId&&!log.orphaned){
        const action=s.goals.find(g=>String(g.id)===String(log.actionId));
        if(!action||Number(action.level)!==3)errors.push('log-action-invalid');
      }
    }
    for(const [k,d] of Object.entries(s.reviewDecisions||{})){
      if(!/^(activity|scholarship):.+/.test(k)||!['approve','exclude','pending'].includes(d.action))errors.push('review-decision-invalid');
    }
    for(const ev of s.personalEvents){
      if(!ev.id||!ev.title||!dateKeyOk(ev.date)||!ev.date)errors.push('personal-event-invalid');
    }
    return errors;
  }
  function touch(state){const out=normalize(state);out.updatedAt=nowIso();return out;}

  const api={freshState,normalize,validate,validateGoalShape,clone,idleTimer,normalizeTimer,normalizeReviewDecisions,touch};
  root.GMBState=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
