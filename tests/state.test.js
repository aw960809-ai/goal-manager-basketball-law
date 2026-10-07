const assert=require('assert');
const config=require('../config/app-config.js');global.GMB_CONFIG=config;
const State=require('../js/core/state.js');
const s=State.freshState();assert.strictEqual(s.schemaVersion,2);assert.strictEqual(s.profile.institution,'東海大學');assert.strictEqual(s.profile.department,'法律學系');assert.deepStrictEqual(s.goals,[]);assert.deepStrictEqual(s.studyLogs,[]);assert.deepStrictEqual(s.personalEvents,[]);assert.strictEqual(s.timer.status,'idle');assert.deepStrictEqual(State.validate(s),[]);
const legacy={...s,schemaVersion:1,goals:[{id:'a',name:'方向',level:1,parentId:null}]};assert.strictEqual(State.normalize(legacy).schemaVersion,2);
const bad=State.freshState();bad.goals=[{id:'x',name:'bad',level:4,parentId:null}];assert(State.validate(bad).includes('goal-level-invalid'));console.log('state.test.js OK');
