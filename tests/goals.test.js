const assert=require('assert');
const config=require('../config/app-config.js');global.GMB_CONFIG=config;
const State=require('../js/core/state.js');global.GMBState=State;
const Goals=require('../js/domain/goals.js');
let s=State.freshState();s=Goals.createPath(s,{direction:'法律專業能力',milestone:'建立民法體系',action:'完成債總第一章'});assert.deepStrictEqual(s.goals.map(g=>g.level),[1,2,3]);const action=s.goals.find(g=>g.level===3);assert.strictEqual(Goals.pathText(s,action.id),'法律專業能力 → 建立民法體系 → 完成債總第一章');s=Goals.updateGoal(s,action.id,{name:'債總 Chapter 1',targetDate:'2026-10-20'});assert.strictEqual(Goals.byId(s,action.id).targetDate,'2026-10-20');assert.strictEqual(Goals.nextAction(s).id,action.id);assert.strictEqual(Goals.progress(s,s.goals[0].id),0);s=Goals.setCompleted(s,action.id,true);assert.strictEqual(Goals.progress(s,s.goals[0].id),100);assert.throws(()=>Goals.addGoal(s,{name:'L4',level:4,parentId:action.id}),/三層/);console.log('goals.test.js OK');
