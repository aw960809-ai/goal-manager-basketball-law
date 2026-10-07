(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.GMBSystemHealth=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const STALE_HOURS=36;
  const str=v=>String(v??'').trim();
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
  function ageHours(value,now=Date.now()){
    if(!value)return null;
    const t=new Date(value).getTime();
    if(!Number.isFinite(t))return null;
    return Math.max(0,(Number(now)-t)/3600000);
  }
  function freshness(updatedAt,now=Date.now()){
    const age=ageHours(updatedAt,now);
    if(age===null)return {status:'unknown',tone:'neutral',label:'更新時間未知',ageHours:null};
    if(age>STALE_HOURS)return {status:'stale',tone:'warn',label:'資料過舊',ageHours:age};
    return {status:'fresh',tone:'good',label:'資料新鮮',ageHours:age};
  }
  function activity(payload,load={ok:true},now=Date.now()){
    if(load?.ok===false)return {kind:'activity',status:'error',tone:'bad',label:'無法讀取',detail:str(load.error)||'活動資料讀取失敗',count:null,updatedAt:'',sourceText:'來源狀態未知'};
    const meta=payload&&typeof payload==='object'?(payload.meta||{}):{},rows=Array.isArray(payload?.events)?payload.events:[];
    const f=freshness(meta.updatedAt,now),sources=num(meta.totalSources??meta.sources),healthy=num(meta.healthySources),failed=num(meta.failedSources??meta.failed);
    let sourceText='來源統計未提供';
    if(sources!==null&&sources>0){
      const h=healthy!==null?healthy:Math.max(0,sources-(failed||0));
      sourceText=`${h}/${sources} 來源正常`;
    }
    return {kind:'activity',...f,count:rows.length,updatedAt:str(meta.updatedAt),sourceText,review:num(meta.needsReview)||0,failed:failed||0};
  }
  function scholarship(payload,load={ok:true},now=Date.now()){
    if(load?.ok===false)return {kind:'scholarship',status:'error',tone:'bad',label:'無法讀取',detail:str(load.error)||'獎學金資料讀取失敗',count:null,updatedAt:'',sourceText:'來源狀態未知'};
    const meta=payload&&typeof payload==='object'?(payload.meta||{}):{},rows=Array.isArray(payload?.scholarships)?payload.scholarships:[],detail=meta.eligibilityDetail||{};
    const f=freshness(meta.updatedAt,now),sources=num(meta.categories),healthy=num(meta.healthyCategories),failed=num(meta.failedCategories);
    let sourceText='來源統計未提供';
    if(sources!==null&&sources>0){const h=healthy!==null?healthy:Math.max(0,sources-(failed||0));sourceText=`${h}/${sources} 類別正常`;}
    return {kind:'scholarship',...f,count:rows.length,updatedAt:str(meta.updatedAt),sourceText,verified:num(detail.detailVerified),unverified:num(detail.detailUnverified),failed:failed||0};
  }
  function calendar(rows,load={ok:true}){
    if(load?.ok===false)return {kind:'calendar',status:'error',tone:'bad',label:'無法讀取',detail:str(load.error)||'校曆資料讀取失敗',count:null};
    const count=Array.isArray(rows)?rows.length:0;
    return count>0?{kind:'calendar',status:'ready',tone:'good',label:'已載入',count}:{kind:'calendar',status:'empty',tone:'warn',label:'目前無資料',count:0};
  }
  function publicSummary(parts){
    const list=[parts.activity,parts.scholarship,parts.calendar].filter(Boolean);
    if(list.some(x=>x.status==='error'))return {status:'error',tone:'bad',label:'部分公開資料無法讀取'};
    if(list.some(x=>x.status==='stale'))return {status:'stale',tone:'warn',label:'公開資料需要更新'};
    if(list.some(x=>x.status==='unknown'||x.status==='empty'))return {status:'attention',tone:'warn',label:'公開資料需要確認'};
    return {status:'good',tone:'good',label:'公開資料正常'};
  }
  function versionSummary({pageVersion='',workerVersion='',releaseVersion='',controlled=false,online=true}={}){
    const page=str(pageVersion),worker=str(workerVersion),release=str(releaseVersion);
    if(!online)return {status:'offline',tone:'warn',label:'目前離線',pageVersion:page,workerVersion:worker,releaseVersion:release,controlled:!!controlled,coherent:null,updateAvailable:false};
    const updateAvailable=!!(release&&page&&release!==page);
    const workerMismatch=!!(worker&&page&&worker!==page);
    if(updateAvailable)return {status:'update',tone:'warn',label:'有新版可更新',pageVersion:page,workerVersion:worker,releaseVersion:release,controlled:!!controlled,coherent:false,updateAvailable:true};
    if(workerMismatch)return {status:'mismatch',tone:'bad',label:'頁面與 Service Worker 版本不一致',pageVersion:page,workerVersion:worker,releaseVersion:release,controlled:!!controlled,coherent:false,updateAvailable:false};
    if(!controlled)return {status:'installing',tone:'neutral',label:'PWA 尚未接管此頁',pageVersion:page,workerVersion:worker,releaseVersion:release,controlled:false,coherent:null,updateAvailable:false};
    return {status:'good',tone:'good',label:'版本一致',pageVersion:page,workerVersion:worker,releaseVersion:release,controlled:true,coherent:true,updateAvailable:false};
  }
  function formatAge(hours){
    if(hours===null||hours===undefined||!Number.isFinite(Number(hours)))return '時間未知';
    const n=Number(hours);if(n<1)return '1 小時內';if(n<24)return `${Math.floor(n)} 小時前`;return `${Math.floor(n/24)} 天前`;
  }
  return {STALE_HOURS,ageHours,freshness,activity,scholarship,calendar,publicSummary,versionSummary,formatAge};
});
