const assert=require('assert');
const Sch=require('../js/domain/scholarships.js');
const today='2026-10-07';

const base={id:'x',title:'一般優秀學生獎學金',date:'2026-10-20',deadline:'2026-10-20',kind:'scholarship',url:'https://example.edu.tw/sch',source:'東海大學獎助學金查詢',sourcePriority:'core',auto:true,eligibilityVerified:true,academicScope:'日間學士班1年級(含)以上。',restrictions:'◎在職生不可申請 ◎延修生不可申請'};
const regional={...base,id:'region',title:'地方學生獎學金',restrictions:'◎限設籍嘉義縣6個月以上 ◎一般大學生可申請'};
const economic={...base,id:'economic',title:'清寒優秀學生獎學金',eligibilityTarget:'清寒學生。'};
const identity={...base,id:'identity',title:'原住民學生獎學金',eligibilityTarget:'原住民學生。'};
const military={...base,id:'military',title:'警察子女獎學金',eligibilityTarget:'警察子女。'};
const health={...base,id:'health',title:'身心障礙學生獎學金',eligibilityTarget:'身心障礙學生。'};
const emergency={...base,id:'emergency',title:'急難助學金',eligibilityTarget:'家庭重大變故學生。'};
const affiliation={...base,id:'aff',title:'某扶輪社獎學金',restrictions:'◎申請資格需由各地區扶輪社推薦'};
const grad={...base,id:'grad',title:'研究生論文獎學金',academicScope:'碩士班。博士班。',restrictions:'研究生學位論文寫作'};
const major={...base,id:'major',title:'政治系紀念獎學金',eligibilityTarget:'政治系學生。',academicScope:'日間學士班政治系2年級(含)以上。'};
const language={...base,id:'lang',title:'外語能力檢定獎勵',sourceSubId:'specialty',specialtyKind:'language',restrictions:'通過外語檢定者依級別獎勵'};
const professional={...base,id:'pro',title:'專業證照獎勵補助',sourceSubId:'specialty',specialtyKind:'professional',restrictions:'取得專業證照者可申請'};

const c=Sch.build({scholarships:[base,regional,economic,identity,military,health,emergency,affiliation,grad,major,language,professional]},{today});
assert(c.recommended.some(x=>x.id==='x'));
assert(c.recommended.some(x=>x.id==='lang'));
assert(c.recommended.some(x=>x.id==='pro'));
for(const id of ['region','economic','identity','military','health','emergency','aff','grad','major'])assert(!c.recommended.some(x=>x.id===id),`${id} 不得進推薦`);
const code=id=>c.excluded.find(x=>x.id===id)?.eligibility?.code;
assert.strictEqual(code('region'),'REGION');
assert.strictEqual(code('economic'),'ECONOMIC');
assert.strictEqual(code('identity'),'IDENTITY');
assert.strictEqual(code('military'),'MILITARY_PUBLIC');
assert.strictEqual(code('health'),'HEALTH');
assert.strictEqual(code('emergency'),'SPECIAL_CIRCUMSTANCE');
assert.strictEqual(code('aff'),'AFFILIATION');
assert.strictEqual(code('grad'),'STUDENT_LEVEL');
assert.strictEqual(code('major'),'MAJOR');
assert(c.recommended.find(x=>x.id==='lang').fit.score>c.recommended.find(x=>x.id==='x').fit.score);
assert(c.recommended.find(x=>x.id==='pro').fit.score>c.recommended.find(x=>x.id==='x').fit.score);

// 「縣市限制一律排除」必須比任何加分優先。
const regionalLanguage={...language,id:'regional-lang',restrictions:'限設籍臺中市6個月以上；通過外語檢定者可申請'};
const r=Sch.assess(regionalLanguage,{today});
assert.strictEqual(r.bucket,'excluded');
assert.strictEqual(r.eligibility.code,'REGION');
console.log('scholarships.test.js OK');
