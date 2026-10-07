(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.GMBScholarships=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const CODE_LABELS=Object.freeze({
    REGION:'縣市／地域限制',ECONOMIC:'清寒／經濟弱勢',IDENTITY:'特定族群／身分',MILITARY_PUBLIC:'軍公教／軍警消',
    HEALTH:'疾病／身障／醫療',SPECIAL_CIRCUMSTANCE:'急難／災害／特殊遭遇',AFFILIATION:'特定組織／親屬',
    STUDENT_LEVEL:'學制不符',MAJOR:'科系不符',UNVERIFIED:'資格尚未完成驗證',EXPIRED:'已截止／失效',DUPLICATE:'重複資料',MANUAL_EXCLUDED:'人工排除',MANUAL_APPROVED:'人工核准',PASS:'可推薦'
  });
  const SPECIALTY_LABELS=Object.freeze({professional:'專業考照',language:'外語能力',general:'一般獎學金'});
  const REGION_PLACES=/(?:基隆|臺北|台北|新北|桃園|新竹|苗栗|臺中|台中|彰化|南投|雲林|嘉義市|嘉義縣|臺南|台南|高雄|屏東|宜蘭|花蓮|臺東|台東|澎湖|金門|連江|恆春|熱河省)/;
  const REGION_QUALIFIER=/(?:戶籍|設籍|原籍|籍貫|居住|居民|就讀|在學|本縣學生|本市學生|本鄉學生|本鎮學生|本區學生)/;
  const REGION_MANDATORY=/(?:僅限|限定|限於|限設籍|必須|須具備|需具備|申請對象|獎助對象|受獎對象|資格條件|申請資格)/;
  const REGION_UNRESTRICTED=/(?:不限地區|不限戶籍|不限設籍|不限縣市|戶籍不限|地區不限|全國皆可|全臺皆可|全台皆可|全國大專|全國學生)/;
  const ECONOMIC_RX=/(?:清寒|低收入戶|中低收入戶|經濟弱勢|弱勢家庭|弱勢學生|家庭經濟困難|家境困難|家境清寒|經濟困難|家庭收入|家戶所得|不利處境)/;
  const IDENTITY_RX=/(?:原住民|原住民族|新住民|新住民子女|僑生|外籍生|境外生|陸生|蒙藏生|特殊境遇家庭)/;
  const MILITARY_RX=/(?:軍公教|軍警消|現役軍人|軍人子女|軍人遺族|軍眷|公務人員|公務員子女|公教人員|榮民|榮眷|警察子女|警政署|警察機關)/;
  const HEALTH_IDENTITY_RX=/(?:身心障礙|身障|重大傷病|罕見疾病|癌症|癌友|病友|病患|患者|慢性病|特殊疾病|病童|心臟病兒童|先天性心臟病|視障|聽障|癲癇)/;
  const HEALTH_TREATMENT_RX=/(?:手術|開刀|治療|化療|放射治療|心導管|心臟導管|器官移植|洗腎|透析|住院|醫師診斷|診斷證明|病歷證明)/;
  const HEALTH_HISTORY_RX=/(?:罹患|患有|曾患|曾於|曾接受|接受過|經診斷|診斷為|治療者|手術者|病史)/;
  const SPECIAL_RX=/(?:天然災害|重大災害|受災|災區|火災|水災|震災|風災|急難|家庭重大變故|家中突遭變故|家庭遇重大變故|失親|孤兒|遺孤|父母雙亡|單親|家暴|家庭暴力|特殊事故|非自願性失業)/;
  const AFFILIATION_RX=/(?:員工子女|職員子女|教職員子女|會員子女|校友子女|宗親|宗族|同鄉會|獅子會|扶輪社|青商會|工會會員|協會會員|公司員工|企業員工|眷屬|信徒|教友|特定姓氏)/;
  const LAW_OK_RX=/(?:法律|法學|不限科系|不限學系|各系|各學系|全校學生|全校各系|全校各學系)/;
  const NON_LAW_RX=/(?:管理學院|國貿|國際經營與貿易|企管|企業管理|財金|財務金融|會計|經濟|醫學|牙醫|護理|藥學|工程|工學院|電機|資訊|資工|機械|土木|化工|材料|建築|農業|農學|獸醫|生命科學|生物|化學|物理|數學|理學院|文學院|外文|中文|歷史|地理|政治系|政治學系|社工|社會工作|心理|教育|師培|音樂|美術|藝術|體育|餐旅|觀光)/;
  const TRUSTED_SOURCE_RX=/(?:東海大學|教育部|政府|中央研究院|基金會|協會|公會|學會|公司|銀行|文教)/;

  function str(v){return String(v??'').replace(/\s+/g,' ').trim()}
  function lower(v){return str(v).toLowerCase()}
  function asArray(v){return Array.isArray(v)?v:[]}
  function clauses(text){return str(text).split(/[。；;\n]/).map(x=>x.trim()).filter(Boolean)}
  function dayKey(input){const d=input instanceof Date?input:new Date(input||Date.now());if(Number.isNaN(d.getTime()))return '';return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
  function textCorpus(raw){return [raw?.title,raw?.eligibilityTarget,raw?.restrictions,raw?.academicScope,raw?.requiredDocuments,raw?.applicationNote,raw?.description,raw?.statusText,raw?.keywords].map(str).join(' ')}
  function strictCorpus(raw){return {title:str(raw?.title),target:str(raw?.eligibilityTarget||raw?.audience||raw?.target),restrictions:str(raw?.restrictions),academic:str(raw?.academicScope||raw?.eligibility),documents:str(raw?.requiredDocuments||raw?.documents||raw?.attachments),note:str(raw?.applicationNote||raw?.description||raw?.statusText)}}
  function generalAccess(target){return /(?:一般學生|一般優秀學生|一般在學生|全校學生|本校學生|各系學生|各學系學生|不限科系|不限學系|不限身分|全體學生)/.test(str(target))}
  function positiveClause(text,rx){
    const mandatory=/(?:僅限|限|限定|必須|須具備|需具備|需由|須由|申請資格|申請對象|獎助對象|補助對象|受獎對象|資格條件|專供|提供予|發給|限於|須檢附|需檢附|應檢附|證明)/;
    const optional=/(?:另|另外|額外|加發|加碼|優先|酌予加分|得另申請|可另申請|另可申請|報名費補助|考試費補助|費用補助)/;
    const negative=/(?:不得領|不得同時|不可同時|未享|未領|未曾領|不具|不含|除外|排除|非屬|非為)/;
    return clauses(text).some(c=>rx.test(c)&&mandatory.test(c)&&!optional.test(c)&&!negative.test(c));
  }
  function regionReason(c){
    const scope=[c.target,c.restrictions,c.academic,c.documents,c.note].join(' ');
    if(!str(scope))return null;
    for(const clause of str(scope).split(/[。；;，,\n]/).map(x=>x.trim()).filter(Boolean)){
      if(REGION_UNRESTRICTED.test(clause))continue;
      const hasPlace=REGION_PLACES.test(clause),hasQualifier=REGION_QUALIFIER.test(clause),hasMandatory=REGION_MANDATORY.test(clause);
      if(hasPlace&&hasQualifier)return '具有縣市／地域必要資格；依本系統規則一律排除';
      if(hasPlace&&hasMandatory&&/(?:本縣|本市|本鄉|本鎮|本區|戶籍|設籍|居住|就讀|在學)/.test(clause))return '具有縣市／地域必要資格；依本系統規則一律排除';
      if(/(?:本縣|本市|本鄉|本鎮|本區)/.test(clause)&&(hasQualifier||hasMandatory))return '具有地方性縣市／鄉鎮區限制';
      if(/(?:戶籍謄本|戶籍證明|設籍證明|居住證明)/.test(clause)&&hasPlace)return '申請必備文件要求特定縣市／地域證明';
      if(/(?:限設籍|限制籍貫|籍貫為|祖籍為).{0,16}(?:省|縣|市|地區)/.test(clause))return '具有地域／籍貫必要資格；依本系統規則排除';
    }
    return null;
  }
  function economicReason(c){
    if(ECONOMIC_RX.test(c.title))return '獎助名稱限定清寒／低收入／經濟弱勢對象';
    if(!generalAccess(c.target)&&ECONOMIC_RX.test(c.target))return '獎助對象限定清寒／低收入／經濟弱勢身分';
    if(positiveClause([c.restrictions,c.documents,c.academic].join(' '),ECONOMIC_RX))return '清寒／低收入／經濟條件為必要資格';
    if(/(?:家庭|家戶).{0,12}(?:年所得|收入|所得).{0,14}(?:以下|未滿|不超過)|(?:家庭|家戶).{0,12}(?:不動產|利息所得).{0,14}(?:以下|未滿|不超過)/.test([c.target,c.restrictions].join(' ')))return '家庭所得／資產門檻為必要資格';
    if(/(?:清寒證明|低收入戶證明|中低收入戶證明|所得證明|家庭收入證明|家戶所得)/.test(c.documents))return '申請必備文件要求經濟弱勢證明';
    return null;
  }
  function identityReason(c){
    if(IDENTITY_RX.test(c.title))return '獎助名稱限定特定族群／身分';
    if(!generalAccess(c.target)&&IDENTITY_RX.test(c.target))return '獎助對象限定特定族群／身分';
    if(positiveClause([c.restrictions,c.documents,c.academic].join(' '),IDENTITY_RX))return '特定族群／身分為必要資格';
    if(/(?:原住民身分證明|原住民族身分證明|僑生證明|外籍生證明|新住民證明)/.test(c.documents))return '申請必備文件要求特定身分證明';
    return null;
  }
  function militaryReason(c){
    if(MILITARY_RX.test(c.title))return '獎助名稱限定軍公教／軍警消等身分';
    if(!generalAccess(c.target)&&MILITARY_RX.test(c.target))return '獎助對象限定軍公教／軍警消等身分';
    if(positiveClause([c.restrictions,c.documents,c.academic].join(' '),MILITARY_RX))return '軍公教／軍警消等為必要資格';
    return null;
  }
  function healthReason(c){
    if(HEALTH_IDENTITY_RX.test(c.title))return '獎助名稱限定疾病／傷病／身心障礙身分';
    if(!generalAccess(c.target)&&HEALTH_IDENTITY_RX.test(c.target))return '獎助對象限定疾病／傷病／身心障礙身分';
    if(HEALTH_IDENTITY_RX.test(c.restrictions))return '疾病／傷病／身心障礙為必要限制條件';
    if(HEALTH_TREATMENT_RX.test(c.restrictions)&&HEALTH_HISTORY_RX.test(c.restrictions))return '特定手術／治療經歷為必要資格';
    if(/(?:身心障礙證明|重大傷病卡|診斷證明|病歷證明|手術證明)/.test(c.documents))return '申請必備文件要求醫療／身障證明';
    return null;
  }
  function circumstanceReason(c){
    if(SPECIAL_RX.test(c.title))return '獎助名稱限定急難／受災／特殊家庭遭遇';
    if(!generalAccess(c.target)&&SPECIAL_RX.test(c.target))return '獎助對象限定急難／受災／特殊家庭遭遇';
    if(positiveClause([c.restrictions,c.documents].join(' '),SPECIAL_RX))return '急難／受災／特殊家庭遭遇為必要資格';
    if(/(?:受災證明|災害證明|死亡證明|急難證明)/.test(c.documents)&&SPECIAL_RX.test([c.restrictions,c.target,c.title].join(' ')))return '申請必備文件要求特殊遭遇證明';
    return null;
  }
  function affiliationReason(c){
    if(AFFILIATION_RX.test(c.title))return '獎助名稱限定特定組織／親屬／宗親身分';
    if(!generalAccess(c.target)&&AFFILIATION_RX.test(c.target))return '獎助對象限定特定組織／親屬身分';
    if(positiveClause([c.restrictions,c.documents].join(' '),AFFILIATION_RX))return '特定組織／親屬身分為必要資格';
    return null;
  }
  function studentLevelReason(c){
    const s=[c.title,c.target,c.academic,c.restrictions].join(' '),academic=str(c.academic);
    const undergradRx=/(?:大學部|學士班|大專校院|大專院校|大學生|大專生|日間學士班|各級學生|全校學生)/;
    if(academic&&/(?:碩士班|博士班|研究生)/.test(academic)&&!undergradRx.test(academic))return '學制限定研究所／碩博士班，非目前一般大學部推薦';
    if(undergradRx.test(s))return null;
    if(/(?:僅限|限|限定|專供|申請對象|獎助對象).{0,24}(?:國小|國中|高中|高職|高中職|五專前三年|碩士班|博士班|研究生|在職專班)/.test(s))return '限定其他教育階段／學制';
    if(/(?:國小生|國中生|高中生|高職生|高中職學生|碩士生|博士生|研究生)(?:專用|專屬|獎學金|助學金)/.test(s))return '獎助名稱限定其他教育階段';
    return null;
  }
  function majorReason(c){
    const s=[c.title,c.target,c.academic,c.restrictions].join(' ');
    if(!str(s)||LAW_OK_RX.test(s))return null;
    if(NON_LAW_RX.test(s))return '限定非法律系之特定科系／學門';
    if(!/(?:學院|學系|科系|系所|學門)/.test(s))return null;
    if(/(?:僅限|限|限定|專供|申請對象|獎助對象).{0,45}(?:學院|學系|科系|系所|學門)/.test(s))return '存在特定科系／學門限制，未證明法律系可申請';
    return null;
  }
  function specialtyKind(raw){
    const k=lower(raw?.specialtyKind),text=lower(textCorpus(raw));
    if(k==='professional'||/專業證照|專業考照|證照獎勵|專門職業|技術人員|國家考試|司法官|律師/.test(text))return 'professional';
    if(k==='language'||/外語能力|外語檢定|英語檢定|日語檢定|多益|toeic|托福|toefl|雅思|ielts|日檢|jlpt/.test(text))return 'language';
    return 'general';
  }
  function sourceTrusted(raw){
    if(raw?.government===true)return true;
    if(['core','government','official'].includes(lower(raw?.sourcePriority)))return true;
    return TRUSTED_SOURCE_RX.test([raw?.source,raw?.title,raw?.url].join(' '));
  }
  function sourceRank(raw){
    let n=0;
    if(raw?.eligibilityVerified===true)n+=100;
    const sub=lower(raw?.sourceSubId);if(sub==='specialty')n+=50;else if(sub==='campus'||sub==='department')n+=40;else if(sub==='government')n+=30;else if(sub==='external')n+=20;
    const p=lower(raw?.sourcePriority);if(p==='core')n+=12;else if(p==='government')n+=8;
    if(raw?.auto===true)n+=4;
    if(str(raw?.detailUrl))n+=2;
    return n;
  }
  function titleKey(raw){return lower(raw?.title).replace(/[\s\-—–_【】\[\]（）()：:·]/g,'')}
  function dedupe(rows){
    const selected=new Map(),duplicates=[];
    asArray(rows).forEach((raw,index)=>{
      const key=titleKey(raw)||`row-${index}`;
      const current=selected.get(key);
      if(!current){selected.set(key,{raw,index});return}
      if(sourceRank(raw)>sourceRank(current.raw)){duplicates.push(current.raw);selected.set(key,{raw,index})}else duplicates.push(raw);
    });
    return {rows:[...selected.values()].map(x=>x.raw),duplicates};
  }
  function normalize(raw,index=0){
    const x=raw&&typeof raw==='object'?raw:{};
    return {
      id:str(x.id)||`sch-${index+1}`,
      title:str(x.title)||'未命名獎學金',
      deadline:str(x.deadline||x.date),date:str(x.date),url:str(x.detailUrl||x.url),overviewUrl:str(x.url),amount:str(x.amount),category:str(x.category),
      source:str(x.source),sourceId:str(x.sourceId),sourceSubId:str(x.sourceSubId),sourcePriority:str(x.sourcePriority),statusText:str(x.statusText),applicationWindow:str(x.applicationWindow),
      eligibilityTarget:str(x.eligibilityTarget),restrictions:str(x.restrictions),academicScope:str(x.academicScope),requiredDocuments:str(x.requiredDocuments),applicationNote:str(x.applicationNote),scoreCondition:str(x.scoreCondition),
      eligibilityVerified:x.eligibilityVerified===true,eligibilityError:str(x.eligibilityError),needsReview:x.needsReview===true,missCount:Number(x.missCount||0)||0,
      available:x.available!==false,direct:x.direct!==false,kind:str(x.kind||'scholarship'),government:x.government===true,auto:x.auto===true,
      specialtyKind:specialtyKind(x),specialtyLabel:SPECIALTY_LABELS[specialtyKind(x)],trustedSource:sourceTrusted(x),_raw:x
    };
  }
  function isResource(item){return item.kind!=='scholarship'||(!item.deadline&&/(?:入口|整理|資訊網|查詢)/.test(item.title))}
  function requiresVerifiedDetail(item){
    const raw=item._raw||{};const id=str(raw.id),specialty=item.specialtyKind!=='general'||str(raw.sourceSubId)==='specialty';
    return id.startsWith('auto-thu-sch-')&&!specialty;
  }
  function eligibility(item){
    const c=strictCorpus(item._raw||item),checks=[
      ['REGION',regionReason(c)],['ECONOMIC',economicReason(c)],['IDENTITY',identityReason(c)],['MILITARY_PUBLIC',militaryReason(c)],
      ['HEALTH',healthReason(c)],['SPECIAL_CIRCUMSTANCE',circumstanceReason(c)],['AFFILIATION',affiliationReason(c)],['STUDENT_LEVEL',studentLevelReason(c)],['MAJOR',majorReason(c)]
    ];
    for(const [code,reason] of checks)if(reason)return {eligible:false,code,reason,label:CODE_LABELS[code]};
    if(requiresVerifiedDetail(item)&&!item.eligibilityVerified)return {eligible:false,review:true,code:'UNVERIFIED',reason:'東海官方詳細資格尚未完成驗證，暫不推薦',label:CODE_LABELS.UNVERIFIED};
    if(item.auto&&!item.eligibilityVerified&&item.specialtyKind==='general')return {eligible:false,review:true,code:'UNVERIFIED',reason:'詳細資格尚未完成驗證，暫不推薦',label:CODE_LABELS.UNVERIFIED};
    return {eligible:true,code:'PASS',reason:'通過硬性資格審查',label:CODE_LABELS.PASS};
  }
  function score(item){
    const text=textCorpus(item._raw||item);let value=44,priority=0,reasons=[];
    if(/東海|東海大學|tunghai/i.test(text)){value+=16;reasons.push('東海校內申請管道 +16')}
    if(/法律|法治|司法|法學|律師|司法官|專門職業及技術人員/.test(text)){value+=15;reasons.push('法律／法政相關 +15')}
    if(/成績|學業|gpa|排名|優良|優秀/i.test(text)){value+=5;reasons.push('學業表現型 +5')}
    if(item.trustedSource){value+=5;reasons.push('官方／可信來源 +5')}
    if(item.specialtyKind==='professional'){value+=28;priority=3;reasons.unshift('專業考照獎勵 +28')}
    if(item.specialtyKind==='language'){value+=30;priority=3;reasons.unshift('外語能力獎勵 +30')}
    if(item.specialtyKind==='professional'&&/法律|司法|律師|專技|國家考試/.test(text)){value+=5;reasons.unshift('法律專業考試延伸 +5')}
    value=Math.max(0,Math.min(99,Math.round(value)));
    const tier=value>=80?'high':value>=65?'possible':'general';
    return {score:value,priority,tier,tierLabel:tier==='high'?'高度推薦':tier==='possible'?'優先留意':'一般推薦',reasons};
  }
  function assess(raw,context={},index=0){
    const today=context.today||dayKey(),item=normalize(raw,index);
    if(!item.available)return {...item,bucket:'archive',eligibility:{eligible:false,code:'EXPIRED',reason:'資料已標記不可用',label:CODE_LABELS.EXPIRED},fit:score(item)};
    if(item.deadline&&item.deadline<today)return {...item,bucket:'archive',eligibility:{eligible:false,code:'EXPIRED',reason:'申請期限已截止',label:CODE_LABELS.EXPIRED},fit:score(item)};
    if(isResource(item))return {...item,bucket:'resource',eligibility:{eligible:false,code:'RESOURCE',reason:'常設／查詢資源',label:'相關資源'},fit:score(item)};
    if(item.needsReview||item.missCount>=2||!item.trustedSource||!item.url)return {...item,bucket:'review',eligibility:{eligible:false,review:true,code:'UNVERIFIED',reason:item.needsReview?'來源資料標記待複核':item.missCount>=2?`來源已連續 ${item.missCount} 次未確認`:!item.trustedSource?'來源可信度尚待確認':'缺少官方資訊連結',label:CODE_LABELS.UNVERIFIED},fit:score(item)};
    const e=eligibility(item),fit=score(item);
    if(!e.eligible)return {...item,bucket:e.review?'review':'excluded',eligibility:e,fit};
    return {...item,bucket:'recommended',eligibility:e,fit};
  }
  function sortRecommended(a,b){return (b.fit.priority-a.fit.priority)||(b.fit.score-a.fit.score)||((a.deadline||'9999-12-31').localeCompare(b.deadline||'9999-12-31'))||a.title.localeCompare(b.title,'zh-Hant')}
  function build(payload,context={}){
    const raw=asArray(payload?.scholarships??payload),d=dedupe(raw),assessed=d.rows.map((x,i)=>assess(x,context,i));
    const duplicates=d.duplicates.map((x,i)=>({...normalize(x,i),bucket:'archive',eligibility:{eligible:false,code:'DUPLICATE',reason:'同名資料已由較完整來源取代',label:CODE_LABELS.DUPLICATE},fit:score(normalize(x,i))}));
    const all=[...assessed,...duplicates];
    const recommended=all.filter(x=>x.bucket==='recommended').sort(sortRecommended);
    const review=all.filter(x=>x.bucket==='review').sort((a,b)=>(a.deadline||'9999-12-31').localeCompare(b.deadline||'9999-12-31'));
    const resources=all.filter(x=>x.bucket==='resource').sort((a,b)=>a.title.localeCompare(b.title,'zh-Hant'));
    const excluded=all.filter(x=>x.bucket==='excluded');
    const archive=all.filter(x=>x.bucket==='archive');
    return {recommended,review,resources,excluded,archive,all,meta:payload?.meta||{},duplicates:duplicates.length};
  }
  function matches(row,filters={}){
    const q=lower(filters.q),kind=filters.kind||'all',tier=filters.tier||'all';
    if(kind!=='all'&&row.specialtyKind!==kind)return false;
    if(tier!=='all'&&row.fit?.tier!==tier)return false;
    if(q){const hay=lower([row.title,row.source,row.category,row.amount,row.eligibilityTarget,row.academicScope,row.specialtyLabel].join(' '));if(!hay.includes(q))return false}
    return true;
  }
  function filter(rows,filters={}){return asArray(rows).filter(x=>matches(x,filters))}
  function stats(rows){
    const list=asArray(rows),specialty={professional:0,language:0,general:0},tiers={high:0,possible:0,general:0};
    list.forEach(x=>{specialty[x.specialtyKind]=(specialty[x.specialtyKind]||0)+1;tiers[x.fit?.tier]=(tiers[x.fit?.tier]||0)+1});
    return {total:list.length,specialty,tiers};
  }
  function exclusionStats(rows){const out={};asArray(rows).forEach(x=>{const c=x.eligibility?.code||'OTHER';out[c]=(out[c]||0)+1});return out}

  return Object.freeze({CODE_LABELS,SPECIALTY_LABELS,normalize,eligibility,score,assess,build,filter,stats,exclusionStats,regionReason,specialtyKind,dedupe});
});
