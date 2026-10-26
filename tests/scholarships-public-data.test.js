const assert=require('assert');
const fs=require('fs');
const path=require('path');
const Sch=require('../js/domain/scholarships.js');
const payload=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','scholarships.json'),'utf8'));

// This is a rotating live catalog: specialty awards can legitimately disappear
// after the application deadline. Do not require one specific award forever.
const today=new Date().toISOString().slice(0,10);
assert(Array.isArray(payload.scholarships)&&payload.scholarships.length>0,'公開獎學金資料應存在');
const cat=Sch.build(payload,{today});
const all=[...cat.recommended,...cat.review,...cat.resources,...cat.excluded,...cat.archive];
assert.strictEqual(all.length,payload.scholarships.length,'所有來源紀錄都應歸入一個分類');
assert(cat.recommended.every(x=>!x.deadline||x.deadline>=today),'已截止的獎學金不得進推薦');
assert(!cat.recommended.some(x=>/嘉義市清寒優秀學生獎學金|金門縣政府獎學金|高雄市清寒優秀學生獎學金/.test(x.title)),'縣市限制項目不得進推薦');
assert(!cat.recommended.some(x=>/政治系/.test(x.title)),'限定其他科系不得進法律系推薦');
assert(cat.recommended.every(x=>x.eligibility.code==='PASS'),'推薦案件必須通過資格審查');
assert(cat.review.every(x=>x.bucket==='review'));
assert(cat.resources.every(x=>x.bucket==='resource'));

// Independent regression fixtures validate the lasting eligibility policy,
// regardless of which real-world scholarships are currently open.
const future=`${Number(today.slice(0,4))+1}-12-31`;
const past=`${Number(today.slice(0,4))-1}-12-31`;
const base={id:'fixture-base',title:'一般優秀學生獎學金',deadline:future,kind:'scholarship',url:'https://example.edu.tw/sch',source:'東海大學獎助學金查詢',sourcePriority:'core',auto:true,eligibilityVerified:true,academicScope:'日間學士班1年級(含)以上。'};
const professional={...base,id:'fixture-professional',title:'專業證照獎勵補助',sourceSubId:'specialty',specialtyKind:'professional'};
const language={...base,id:'fixture-language',title:'外語能力檢定獎勵',sourceSubId:'specialty',specialtyKind:'language'};
const region={...base,id:'fixture-region',title:'地方學生獎學金',restrictions:'限設籍嘉義縣6個月以上'};
const economic={...base,id:'fixture-economic',title:'清寒學生獎學金',eligibilityTarget:'清寒學生。'};
const major={...base,id:'fixture-major',title:'政治系紀念獎學金',eligibilityTarget:'政治系學生。'};
const fixture=Sch.build({scholarships:[professional,language,region,economic,major]},{today});
assert(fixture.recommended.some(x=>x.id===professional.id&&x.specialtyKind==='professional'),'專業證照獎勵應正確分類及推薦');
assert(fixture.recommended.some(x=>x.id===language.id&&x.specialtyKind==='language'),'外語能力獎勵應正確分類及推薦');
const rejected=id=>fixture.excluded.find(x=>x.id===id)?.eligibility.code;
assert.strictEqual(rejected(region.id),'REGION','地域資格必須排除');
assert.strictEqual(rejected(economic.id),'ECONOMIC','經濟弱勢資格必須排除');
assert.strictEqual(rejected(major.id),'MAJOR','不相符科系必須排除');
assert.strictEqual(Sch.assess({...language,id:'fixture-expired',deadline:past},{today}).eligibility.code,'EXPIRED','已截止獎勵必須封存');
console.log('scholarships-public-data.test.js OK');
