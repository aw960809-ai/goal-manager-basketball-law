const assert=require('assert');
const Opp=require('../js/domain/opportunities.js');

const today='2026-10-07';
const law={id:'law',title:'東海法律學院：憲法與人權實務講座',date:'2026-10-20',scope:'東海校內',kind:'event',url:'https://law.thu.edu.tw/event',organizer:'法律學院',source:'東海大學法律學院',sourceTrust:'official',direct:true,available:true};
const generic={id:'generic',fitScore:100,fitTier:'高適配',goalMatches:['法律／轉學考'],title:'企業人才招募暨實習說明會',date:'2026-10-20',scope:'東海校內',kind:'event',url:'https://tevent.thu.edu.tw/x',organizer:'實習與學生成就中心',source:'東海大學活動報名系統',sourceTrust:'official',direct:true,available:true,keywords:'法律／學術 校內'};
const review={...law,id:'review',title:'大學生法律生存指南',needsReview:true,missCount:3};
const missing={...generic,id:'missing',missCount:2};
const resource={id:'resource',title:'青年國際交流官方計畫入口',kind:'program',openEnded:true,scope:'海外／國際',url:'https://example.gov.tw',source:'外交部',government:true};
const expired={...law,id:'expired',date:'2026-09-01'};

const cat=Opp.build({events:[generic,review,law,resource,missing,expired]},{today,goals:[{name:'憲法與行政法'}]});
assert.strictEqual(cat.recommended.length,2);
assert.strictEqual(cat.recommended[0].id,'law','法律系直接相關活動必須排在一般校內活動之前');
assert(cat.recommended[0].fit.score>cat.recommended[1].fit.score);
assert.strictEqual(cat.recommended[1].category,'career','不得因 legacy keywords 的「法律／學術」把一般實習活動判成法律活動');
assert(cat.review.some(x=>x.id==='review'));
assert(cat.review.some(x=>x.id==='missing'));
assert(!cat.recommended.some(x=>x.needsReview||x.missCount>=2));
assert(cat.resources.some(x=>x.id==='resource'));
assert(cat.archive.some(x=>x.id==='expired'));
assert.strictEqual(Opp.normalize({...generic,scope:'臺中市'},0).circleKey,'taichung','圈層應以地理資訊而非來源名稱判定');
assert.strictEqual(Opp.normalize({...generic,location:'臺中市西屯區某企業',scope:'東海校內'},0).circleKey,'taichung','明確校外台中地點必須優先於來源／scope 的校內標籤');
assert.strictEqual(Opp.normalize({...generic,source:'臺中市就業服務處',organizer:'臺中市就業服務處',scope:'台中',schoolName:''},0).circleKey,'taichung');
assert.strictEqual(Opp.normalize({...generic,source:'活動主辦',organizer:'活動主辦',scope:'彰化縣',schoolName:''},0).circleKey,'central');
assert.strictEqual(Opp.normalize({...generic,source:'全國主辦',organizer:'全國主辦',scope:'全臺',schoolName:''},0).circleKey,'national');

const filtered=Opp.filter(cat.recommended,{circle:'thu',tier:'high'});
const stats=Opp.stats(filtered);
assert.strictEqual(stats.total,filtered.length);
assert.strictEqual(stats.circles.thu,filtered.length);
console.log('opportunities.test.js OK');
