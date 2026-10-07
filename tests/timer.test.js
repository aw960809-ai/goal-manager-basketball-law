const assert=require('assert');
const config=require('../config/app-config.js');global.GMB_CONFIG=config;
const State=require('../js/core/state.js');global.GMBState=State;
const Logs=require('../js/domain/study-logs.js');global.GMBStudyLogs=Logs;
const Timer=require('../js/services/timer.js');
let s=State.freshState();const t0=Date.parse('2026-10-07T12:00:00Z');s=Timer.start(s,{mode:'free',label:'課堂複習'},t0);assert.strictEqual(Timer.elapsedMs(s.timer,t0+65000),65000);s=Timer.pause(s,t0+65000);assert.strictEqual(s.timer.status,'paused');s=Timer.resume(s,t0+70000);const done=Timer.complete(s,t0+100000);assert.strictEqual(done.log.kind,'other-study');assert.strictEqual(done.log.source,'timer');assert.strictEqual(done.log.durationSeconds,95);assert.strictEqual(done.state.timer.status,'idle');assert.strictEqual(done.state.studyLogs.length,1);console.log('timer.test.js OK');
