(function(root){
  'use strict';
  function dayKey(value){const d=value instanceof Date?value:new Date(value);if(Number.isNaN(d.getTime()))return '';return[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
  function seconds(logs){return(logs||[]).reduce((n,l)=>n+Math.max(0,Number(l.durationSeconds)||0),0)}
  function minutes(logs){return Math.round(seconds(logs)/60)}
  function todayLogs(state,now=new Date()){const k=dayKey(now);return(state.studyLogs||[]).filter(l=>dayKey(l.endedAt||l.createdAt)===k)}
  function weekStart(now=new Date()){const d=new Date(now),day=(d.getDay()+6)%7;d.setHours(0,0,0,0);d.setDate(d.getDate()-day);return d}
  function weekLogs(state,now=new Date()){const start=weekStart(now).getTime(),end=start+7*86400000;return(state.studyLogs||[]).filter(l=>{const t=new Date(l.endedAt||l.createdAt).getTime();return t>=start&&t<end})}
  function dailyWeek(state,now=new Date()){const start=weekStart(now);return Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);const k=dayKey(d),logs=(state.studyLogs||[]).filter(l=>dayKey(l.endedAt||l.createdAt)===k);return{date:k,label:['一','二','三','四','五','六','日'][i],minutes:minutes(logs),sessions:logs.length}})}
  function ancestryMap(state){const byId=new Map((state.goals||[]).map(g=>[String(g.id),g]));return actionId=>{const out=[];let cur=byId.get(String(actionId||'')),guard=0;while(cur&&guard++<8){out.unshift(cur);cur=cur.parentId?byId.get(String(cur.parentId)):null}return out}}
  function directionStats(state,logs=state.studyLogs||[]){
    const roots=(state.goals||[]).filter(g=>Number(g.level)===1&&g.status!=='archived'),path=ancestryMap(state);
    return roots.map(root=>{const own=logs.filter(l=>l.actionId&&path(l.actionId)[0]?.id===root.id);return{id:root.id,name:root.name,minutes:minutes(own),sessions:own.length}}).sort((a,b)=>b.minutes-a.minutes||a.name.localeCompare(b.name,'zh-Hant'));
  }
  function milestoneStats(state,rootId,logs=state.studyLogs||[]){
    const path=ancestryMap(state),stages=(state.goals||[]).filter(g=>Number(g.level)===2&&String(g.parentId)===String(rootId)&&g.status!=='archived');
    return stages.map(stage=>{const own=logs.filter(l=>l.actionId&&path(l.actionId)[1]?.id===stage.id);return{id:stage.id,name:stage.name,minutes:minutes(own),sessions:own.length}}).sort((a,b)=>b.minutes-a.minutes||a.name.localeCompare(b.name,'zh-Hant'));
  }
  function streakDays(state,now=new Date()){
    const days=new Set((state.studyLogs||[]).map(l=>dayKey(l.endedAt||l.createdAt)).filter(Boolean));let n=0,d=new Date(now);d.setHours(12,0,0,0);
    while(days.has(dayKey(d))){n++;d.setDate(d.getDate()-1)}return n;
  }
  const api={dayKey,seconds,minutes,todayLogs,weekLogs,dailyWeek,weekStart,directionStats,milestoneStats,streakDays};
  root.GMBAnalytics=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
