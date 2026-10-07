const assert=require('assert');
class MemStorage{constructor(){this.m=new Map()}getItem(k){return this.m.has(k)?this.m.get(k):null}setItem(k,v){this.m.set(k,String(v))}removeItem(k){this.m.delete(k)}}
global.localStorage=new MemStorage();
const config=require('../config/app-config.js');global.GMB_CONFIG=config;
const State=require('../js/core/state.js');global.GMBState=State;
const Goals=require('../js/domain/goals.js');
const Logs=require('../js/domain/study-logs.js');global.GMBStudyLogs=Logs;
const Timer=require('../js/services/timer.js');
const Store=require('../js/core/storage.js');
let s=State.freshState();s=Goals.createPath(s,{direction:'法律',milestone:'民法',action:'債總'});const action=s.goals.find(g=>g.level===3);s=Timer.start(s,{mode:'goal',actionId:action.id,label:action.name},Date.parse('2026-10-07T12:00:00Z'));s=Store.save(s);
assert.strictEqual(JSON.parse(localStorage.getItem(config.storage.key)).timer,undefined);assert.strictEqual(JSON.parse(localStorage.getItem(config.storage.timerKey)).status,'running');
let loaded=Store.load();assert.strictEqual(loaded.timer.status,'running');assert.strictEqual(Timer.elapsedMs(loaded.timer,Date.parse('2026-10-07T12:01:00Z')),60000);
loaded=Goals.updateGoal(loaded,action.id,{name:'債總更新',targetDate:'2026-10-20'});Store.save(loaded);assert(localStorage.getItem(config.storage.backupKey));
localStorage.setItem(config.storage.key,'{bad json');const fallback=Store.load();assert.strictEqual(fallback.goals.find(g=>g.level===3).name,'債總');
console.log('storage.test.js OK');
