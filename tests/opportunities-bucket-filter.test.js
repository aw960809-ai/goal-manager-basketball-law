const assert=require('assert');
const Opp=require('../js/domain/opportunities.js');

const base={date:'2026-10-20',kind:'event',url:'https://example.gov.tw/e',source:'政府活動平台',sourceTrust:'official',direct:true,available:true};
const payload={events:[
  {...base,id:'rec-central',title:'彰化法律學術論壇',scope:'彰化縣',organizer:'法學研究中心'},
  {...base,id:'review-thu',title:'東海校內待確認講座',scope:'東海校內',needsReview:true,organizer:'東海大學'},
  {...base,id:'review-central',title:'南投青年法治講座',scope:'南投縣',needsReview:true,organizer:'政府單位'},
  {id:'resource-central',title:'彰化青年公共參與官方入口',scope:'彰化縣',kind:'program',openEnded:true,url:'https://example.gov.tw/r',source:'政府入口',government:true},
  {id:'resource-national',title:'全國青年官方入口',scope:'全國',kind:'program',openEnded:true,url:'https://example.gov.tw/n',source:'政府入口',government:true}
]};
const cat=Opp.build(payload,{today:'2026-10-07',goals:[]});
const central=Opp.filterBuckets(cat,{circle:'central',category:'all',tier:'all',q:''});
assert(central.recommended.every(x=>x.circleKey==='central'));
assert.deepStrictEqual(central.review.map(x=>x.id),['review-central']);
assert.deepStrictEqual(central.resources.map(x=>x.id),['resource-central']);

const searched=Opp.filterBuckets(cat,{circle:'all',category:'all',tier:'all',q:'南投'});
assert.deepStrictEqual(searched.review.map(x=>x.id),['review-central']);
assert.strictEqual(searched.resources.length,0);
console.log('opportunities-bucket-filter.test.js OK');
