(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.GMBOpportunities=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const CIRCLES=Object.freeze({
    thu:Object.freeze({key:'thu',level:1,label:'① 東海校內'}),
    taichung:Object.freeze({key:'taichung',level:2,label:'② 台中'}),
    central:Object.freeze({key:'central',level:3,label:'③ 中部'}),
    national:Object.freeze({key:'national',level:4,label:'④ 全國'})
  });
  const CIRCLE_ORDER=Object.freeze(['thu','taichung','central','national']);
  const CATEGORY_LABELS=Object.freeze({
    legal:'法律／法政',academic:'學術／研究',career:'職涯／實習',international:'語言／國際',education:'教育／培力',public:'公共參與',general:'一般活動'
  });
  const TIER_LABELS=Object.freeze({high:'高度符合',possible:'可能符合',explore:'探索'});
  const CENTRAL_TERMS=['彰化','彰化縣','苗栗','苗栗縣','南投','南投縣','雲林','雲林縣'];
  const TAICHUNG_TERMS=['臺中','台中','taichung'];
  const LAW_TERMS=['法律','法學','法治','法官','法院','司法','檢察','檢察官','律師','憲法','民法','刑法','行政法','商事法','公司法','智慧財產','人權','犯罪','訴訟','法律系','法律學院','法學院'];
  const POLICY_TERMS=['行政','政策','治理','公共政策','政府','ESG','永續治理','人權','法治','公民'];
  const ACADEMIC_TERMS=['專題研究','研究計畫','學術','研討','講座','講堂','論壇','論文','國科會','研究方法','seminar','research'];
  const CAREER_TERMS=['實習','就業','職涯','招募','企業參訪','人才','履歷','求職','職場','intern','career'];
  const INTL_TERMS=['國際','海外','外語','交換','留學','度假打工','global','international'];
  const EDUCATION_TERMS=['工作坊','培力','增能','教學','課程','認證','訓練','workshop'];
  const PUBLIC_TERMS=['青年','地方創生','公共參與','志工','社會實踐','文化行動'];
  const RESOURCE_TERMS=['官方入口','計畫入口','資源入口','常設','入口'];
  const TRUSTED_SOURCE_TERMS=['東海大學','教育部','外交部','文化部','國科會','政府','臺中市','台中市','青年發展署'];

  function str(v){return String(v??'').trim()}
  function lower(v){return str(v).toLowerCase()}
  function asArray(v){return Array.isArray(v)?v:[]}
  function dayKey(input){
    const d=input instanceof Date?input:new Date(input||Date.now());
    if(Number.isNaN(d.getTime()))return '';
    const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
  function includesAny(text,terms){const t=lower(text);return terms.some(x=>t.includes(lower(x)))}
  function countTerms(text,terms){const t=lower(text);return terms.reduce((n,x)=>n+(t.includes(lower(x))?1:0),0)}
  function unique(arr){return [...new Set(arr.filter(Boolean))]}
  function sourceTrusted(raw){
    const trust=lower(raw?.sourceTrust);
    if(['official','government','core','trusted'].includes(trust))return true;
    if(raw?.government===true)return true;
    return includesAny([raw?.source,raw?.organizer,raw?.url].join(' '),TRUSTED_SOURCE_TERMS);
  }
  function corpus(raw){
    return [raw?.title,raw?.keywords,raw?.type,raw?.category,raw?.organizer,raw?.audience,raw?.source,raw?.statusText,raw?.location,raw?.schoolName].map(str).join(' ');
  }
  function semanticCorpus(raw){
    // Deliberately exclude legacy `keywords`, `type`, fitScore and goalMatches: the old catalog
    // sometimes injected labels such as `法律／學術` into unrelated events.
    return [raw?.title,raw?.organizer,raw?.audience,raw?.source,raw?.statusText,raw?.location,raw?.schoolName].map(str).join(' ');
  }
  function circleKeyFor(raw){
    const location=lower(raw?.location),scope=lower(raw?.scope),city=lower(raw?.city),school=lower(raw?.schoolName);
    // Geography owns the circle. A THU source alone never turns an off-campus event into a campus event.
    if(location){
      if(location.includes('東海大學')||location.includes('東海校內')||location.includes('tunghai'))return 'thu';
      if(TAICHUNG_TERMS.some(x=>location.includes(lower(x))))return 'taichung';
      if(CENTRAL_TERMS.some(x=>location.includes(lower(x))))return 'central';
    }
    if(scope.includes('東海校內')||school.includes('東海大學')||school.includes('tunghai'))return 'thu';
    if(TAICHUNG_TERMS.some(x=>scope.includes(lower(x))||city.includes(lower(x))))return 'taichung';
    if(CENTRAL_TERMS.some(x=>scope.includes(lower(x))||city.includes(lower(x))))return 'central';
    return 'national';
  }
  function categoryFor(raw){
    const text=semanticCorpus(raw);
    if(includesAny(text,LAW_TERMS))return 'legal';
    if(includesAny(text,CAREER_TERMS)||str(raw?.type).includes('職涯'))return 'career';
    if(includesAny(text,INTL_TERMS)||str(raw?.type).includes('國際'))return 'international';
    if(includesAny(text,ACADEMIC_TERMS))return 'academic';
    if(includesAny(text,EDUCATION_TERMS)||str(raw?.type).includes('教育'))return 'education';
    if(includesAny(text,PUBLIC_TERMS)||str(raw?.type).includes('公共'))return 'public';
    return 'general';
  }
  function isResource(raw){
    const kind=lower(raw?.kind);
    if(kind&&kind!=='event')return true;
    if(raw?.openEnded===true)return true;
    if(!str(raw?.date)&&includesAny(corpus(raw),RESOURCE_TERMS))return true;
    return false;
  }
  function normalize(raw,index=0){
    const x=raw&&typeof raw==='object'?raw:{};
    const circleKey=circleKeyFor(x),circle=CIRCLES[circleKey],category=categoryFor(x);
    return {
      id:str(x.id)||`activity-${index+1}`,
      title:str(x.title)||'未命名活動',
      date:str(x.date),time:str(x.time),deadline:str(x.deadline),eventEndDate:str(x.eventEndDate),
      url:str(x.url||x.externalUrl),location:str(x.location),organizer:str(x.organizer),audience:str(x.audience),
      source:str(x.source),sourceId:str(x.sourceId),sourceTrust:str(x.sourceTrust),statusText:str(x.statusText),
      rawType:str(x.type),kind:str(x.kind||'event'),scope:str(x.scope),keywords:str(x.keywords),
      direct:x.direct!==false,team:x.team===true,available:x.available!==false,government:x.government===true,
      needsReview:x.needsReview===true,missCount:Number(x.missCount||0)||0,semanticDuplicateOf:str(x.semanticDuplicateOf),
      radarEligible:x.radarEligible!==false,openEnded:x.openEnded===true,
      circleKey,circleLevel:circle.level,circleLabel:circle.label,category,categoryLabel:CATEGORY_LABELS[category],
      trustedSource:sourceTrusted(x),isResource:isResource(x),_raw:x
    };
  }
  function quality(item,{today=dayKey()}={}){
    if(!item.available||item.radarEligible===false)return {bucket:'archive',reason:'活動目前不可用'};
    if(item.semanticDuplicateOf)return {bucket:'archive',reason:'重複資料'};
    const end=item.eventEndDate||item.date;
    const close=item.deadline||item.date;
    if(!item.openEnded&&end&&end<today&&close&&close<today)return {bucket:'archive',reason:'活動已結束'};
    if(item.isResource)return {bucket:'resource',reason:'常設入口／相關資源'};
    if(item.needsReview)return {bucket:'review',reason:'來源資料標記待複核'};
    if(item.missCount>=2)return {bucket:'review',reason:`來源已連續 ${item.missCount} 次未確認`};
    if(!item.trustedSource)return {bucket:'review',reason:'來源可信度尚待確認'};
    if(!item.direct)return {bucket:'review',reason:'無法確認可由個人直接參與'};
    if(item.team)return {bucket:'review',reason:'需要組隊／團隊資格'};
    if(!item.url)return {bucket:'review',reason:'缺少官方資訊連結'};
    if(!item.date&&!item.deadline)return {bucket:'review',reason:'缺少可確認的活動日期'};
    return {bucket:'candidate',reason:''};
  }
  function goalSignals(goals){
    const text=asArray(goals).map(g=>str(g?.name)).join(' ');
    const terms=unique([...LAW_TERMS,...POLICY_TERMS,...ACADEMIC_TERMS,...CAREER_TERMS,...INTL_TERMS].filter(k=>includesAny(text,[k])));
    return {text,terms};
  }
  function score(item,{goals=[]}={}){
    const text=semanticCorpus(item._raw||item),reasons=[];
    let value=12;
    const aliases=['法律學系','法律系','法學系','法律學院','法學院'];
    if(includesAny([item.organizer,item.source].join(' '),aliases)){value+=45;reasons.push('法律系／法學院直接相關 +45')}
    else if(includesAny(text,LAW_TERMS)){value+=35;reasons.push('法律／法政主題 +35')}
    const policyHits=countTerms(text,POLICY_TERMS);if(policyHits){value+=Math.min(22,12+policyHits*3);reasons.push('公共政策／治理相關')}
    if(includesAny(text,ACADEMIC_TERMS)){value+=18;reasons.push('學術／研究價值 +18')}
    if(includesAny(text,CAREER_TERMS)){value+=16;reasons.push('職涯／實習價值 +16')}
    if(includesAny(text,INTL_TERMS)){value+=10;reasons.push('國際／語言延伸 +10')}
    if(includesAny(text,EDUCATION_TERMS)){value+=6;reasons.push('能力培力 +6')}
    if(includesAny(text,PUBLIC_TERMS)){value+=6;reasons.push('公共參與 +6')}
    const circleBonus={thu:14,taichung:8,central:5,national:0}[item.circleKey]||0;
    if(circleBonus){value+=circleBonus;reasons.push(`${item.circleLabel} 執行成本較低 +${circleBonus}`)}
    if(item.trustedSource){value+=6;reasons.push('官方／可信來源 +6')}
    if(item.date||item.deadline){value+=3;reasons.push('日期明確 +3')}
    const signals=goalSignals(goals),matched=signals.terms.filter(k=>includesAny(text,[k]));
    if(matched.length){const bonus=Math.min(18,matched.length*6);value+=bonus;reasons.push(`與目前目標關鍵字相符 +${bonus}`)}
    value=Math.max(0,Math.min(100,Math.round(value)));
    const tier=value>=80?'high':value>=60?'possible':'explore';
    return {score:value,tier,tierLabel:TIER_LABELS[tier],reasons,goalMatches:matched};
  }
  function assess(raw,context={},index=0){
    const item=normalize(raw,index),q=quality(item,context),fit=score(item,context);
    let bucket=q.bucket;
    if(bucket==='candidate'&&fit.score<42)bucket='low';
    return {...item,qualityBucket:bucket,qualityReason:q.reason,fit};
  }
  function sortRows(a,b){
    return (b.fit.score-a.fit.score)||(a.circleLevel-b.circleLevel)||((a.date||'9999-12-31').localeCompare(b.date||'9999-12-31'))||a.title.localeCompare(b.title,'zh-Hant');
  }
  function build(payload,context={}){
    const rows=asArray(payload?.events??payload).map((x,i)=>assess(x,context,i));
    const recommended=rows.filter(x=>x.qualityBucket==='candidate').sort(sortRows);
    const review=rows.filter(x=>x.qualityBucket==='review').sort((a,b)=>(a.date||'9999-12-31').localeCompare(b.date||'9999-12-31'));
    const resources=rows.filter(x=>x.qualityBucket==='resource').sort(sortRows);
    const archive=rows.filter(x=>x.qualityBucket==='archive');
    const low=rows.filter(x=>x.qualityBucket==='low').sort(sortRows);
    return {meta:payload?.meta||{},rows,recommended,review,resources,archive,low};
  }
  function searchable(row){return lower([row.title,row.organizer,row.source,row.location,row.keywords,row.categoryLabel,row.circleLabel,row.statusText].join(' '))}
  function filter(rows,{q='',circle='all',category='all',tier='all'}={}){
    const needle=lower(q);
    return asArray(rows).filter(row=>{
      if(circle!=='all'&&row.circleKey!==circle)return false;
      if(category!=='all'&&row.category!==category)return false;
      if(tier!=='all'&&row.fit.tier!==tier)return false;
      if(needle&&!searchable(row).includes(needle))return false;
      return true;
    }).sort(sortRows);
  }
  function stats(rows){
    const x=asArray(rows),circles={thu:0,taichung:0,central:0,national:0},tiers={high:0,possible:0,explore:0};
    for(const row of x){if(circles[row.circleKey]!==undefined)circles[row.circleKey]++;if(tiers[row.fit.tier]!==undefined)tiers[row.fit.tier]++}
    return {total:x.length,circles,tiers};
  }
  function filterBuckets(catalog,filters={}){
    const c=catalog&&typeof catalog==='object'?catalog:{};
    return {
      recommended:filter(c.recommended,filters),
      review:filter(c.review,filters),
      resources:filter(c.resources,filters)
    };
  }
  return Object.freeze({CIRCLES,CIRCLE_ORDER,CATEGORY_LABELS,TIER_LABELS,dayKey,normalize,quality,score,assess,build,filter,filterBuckets,stats,circleKeyFor,categoryFor});
});
