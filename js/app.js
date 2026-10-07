(function(){
  'use strict';
  const C=window.GMB_CONFIG,Store=window.GMBStorage,Goals=window.GMBGoals,Logs=window.GMBStudyLogs,Timer=window.GMBTimer,A=window.GMBAnalytics,Opp=window.GMBOpportunities,Sch=window.GMBScholarships,Review=window.GMBReview,Health=window.GMBSystemHealth;
  let state=Store.load(),page='home',schoolCalendar=[],schoolCalendarMeta={},activityPayload={meta:{},events:[]},scholarshipPayload={meta:{},scholarships:[]},activityFilters={q:'',circle:'all',category:'all',tier:'all'},scholarshipFilters={q:'',kind:'all',tier:'all'},tickHandle=null,publicLoadStatus={calendar:{ok:null,error:''},calendarMeta:{ok:null,error:''},activity:{ok:null,error:''},scholarship:{ok:null,error:''}},systemPwaStatus=null;
  const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fmtDate=d=>{try{return new Intl.DateTimeFormat('zh-TW',{month:'numeric',day:'numeric',weekday:'short'}).format(new Date(d+'T00:00:00'))}catch(_){return d}};
  const fmtClock=ms=>{const t=Math.max(0,Math.floor(ms/1000)),h=Math.floor(t/3600),m=Math.floor((t%3600)/60),s=t%60;return[h,m,s].map(x=>String(x).padStart(2,'0')).join(':')};
  const save=()=>{state=Store.save(state);return state};
  function toast(msg){const el=$('#toast');if(!el)return;el.textContent=msg;el.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>el.classList.remove('show'),1800)}
  function downloadJson(filename,obj){const blob=new Blob([JSON.stringify(obj,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500)}
  function nav(next){page=next;$$('.page').forEach(el=>el.classList.toggle('active',el.dataset.page===next));$$('.nav-btn').forEach(el=>el.classList.toggle('active',el.dataset.nav===next||(['opportunities','scholarships','review','system'].includes(next)&&el.dataset.nav==='home')));renderCurrent();window.scrollTo({top:0,behavior:'smooth'})}
  const todayMinutes=()=>A.minutes(A.todayLogs(state));
  const weekMinutes=()=>A.minutes(A.weekLogs(state));
  const weekSessions=()=>A.weekLogs(state).length;
  const totalMinutes=()=>A.minutes(state.studyLogs);
  const currentAction=()=>state.timer?.actionId?Goals.byId(state,state.timer.actionId):null;
  const opportunityContext=()=>({today:A.dayKey(new Date()),goals:state.goals||[]});
  const opportunityAutoCatalog=()=>Opp.build(activityPayload,opportunityContext());
  const opportunityCatalog=()=>Review.applyActivity(opportunityAutoCatalog(),state.reviewDecisions||{});
  function opportunitySummary(){const c=opportunityCatalog();return {recommended:c.recommended.length,high:c.recommended.filter(x=>x.fit.tier==='high').length,review:c.review.length,resources:c.resources.length}}
  const scholarshipContext=()=>({today:A.dayKey(new Date())});
  const scholarshipAutoCatalog=()=>Sch.build(scholarshipPayload,scholarshipContext());
  const scholarshipCatalog=()=>Review.applyScholarship(scholarshipAutoCatalog(),state.reviewDecisions||{});
  function scholarshipSummary(){const c=scholarshipCatalog(),st=Sch.stats(c.recommended);return {recommended:c.recommended.length,professional:st.specialty.professional,language:st.specialty.language,review:c.review.length,excluded:c.excluded.length}}

  function publicHealth(){
    const now=Date.now();
    const activity=Health.activity(activityPayload,publicLoadStatus.activity,now),scholarship=Health.scholarship(scholarshipPayload,publicLoadStatus.scholarship,now),calendar=Health.calendar(schoolCalendar,publicLoadStatus.calendar,schoolCalendarMeta,now);
    return {activity,scholarship,calendar,summary:Health.publicSummary({activity,scholarship,calendar})};
  }
  function pwaHealth(){
    const raw=systemPwaStatus||{pageVersion:C.version,workerVersion:'',releaseVersion:'',controlled:!!navigator.serviceWorker?.controller,online:navigator.onLine!==false};
    return Health.versionSummary(raw);
  }
  function healthToneClass(tone){return tone==='good'?'health-good':tone==='bad'?'health-bad':tone==='warn'?'health-warn':'health-neutral'}
  function homeSystemHealth(){
    const data=publicHealth(),pwa=pwaHealth();
    return `<article class="card system-home-card"><div><p class="eyebrow">SYSTEM HEALTH</p><h3>${esc(data.summary.label)}</h3><p class="muted">Activity ${esc(data.activity.label)} · Scholarship ${esc(data.scholarship.label)} · ${esc(pwa.label)}</p></div><button class="btn" data-go="system">系統狀態</button></article>`;
  }

  function reviewSummary(){
    const a=opportunityCatalog(),s=scholarshipCatalog(),d=Review.stats(state.reviewDecisions||{});
    return {pendingActivity:a.review.length,pendingScholarship:s.review.length,pending:a.review.length+s.review.length,decisions:d};
  }
  function homeReviewCenter(){
    const r=reviewSummary();
    return `<article class="card system-home-card review-home-card"><div><p class="eyebrow">REVIEW CENTER</p><h3>${r.pending} 筆待複核</h3><p class="muted">活動 ${r.pendingActivity} · 獎學金 ${r.pendingScholarship} · 已人工核准 ${r.decisions.approve} · 已人工排除 ${r.decisions.exclude}</p></div><button class="btn" data-go="review">開啟審查</button></article>`;
  }

  function timeline(limit=6){
    const today=A.dayKey(new Date());
    const school=schoolCalendar.filter(e=>e.date>=today).map(e=>({...e,kind:'school',badge:'東海校曆'}));
    const personal=(state.personalEvents||[]).filter(e=>e.date>=today).map(e=>({...e,kind:'personal',badge:'個人'}));
    const goals=Goals.datedGoals(state,today).map(g=>({id:'goal-'+g.id,date:g.targetDate,title:g.name,meta:Goals.pathText(state,g.id),kind:'goal',badge:g.level===3?'具體行動':'目標日期'}));
    return [...school,...personal,...goals].sort((a,b)=>a.date.localeCompare(b.date)||String(a.title).localeCompare(String(b.title),'zh-Hant')).slice(0,limit);
  }
  function renderEventRows(events){
    if(!events.length)return '<div class="empty">目前沒有事件</div>';
    return events.map(e=>`<div class="event-row"><div class="event-date">${esc(fmtDate(e.date))}</div><div><div class="event-title">${esc(e.title)}</div><div class="event-meta">${esc(e.meta||'')}</div><span class="event-badge">${esc(e.badge||'東海校曆')}</span>${e.kind==='personal'?` <button class="icon-btn" data-delete-event="${esc(e.id)}" title="刪除">⌫</button>`:''}</div></div>`).join('');
  }

  function renderHome(){
    const home=$('#pageHome'),roots=Goals.roots(state),next=Goals.nextAction(state);
    if(!state.goals.length){
      home.innerHTML=`<section class="hero"><p class="eyebrow">WELCOME TO YOUR SEASON</p><h1>新的球季，從第一個目標開始。</h1><p>個人資料從空白開始；東海官方校曆與公開資料則維持獨立提供。</p><div class="hero-actions"><button class="btn primary" data-open="goalWizard">建立第一個目標</button><button class="btn" data-go="execute">開始自由計時</button></div></section>
      <div class="section-head"><h2>START HERE</h2><small>先完成一條可用的學習閉環</small></div><div class="quick-row"><button class="quick" data-open="goalWizard"><span class="ico">◎</span><b>建立目標</b><small>方向 → 階段目標 → 具體行動</small></button><button class="quick" data-go="execute"><span class="ico">◷</span><b>開始訓練</b><small>目標計時或自由計時</small></button><button class="quick" data-go="opportunities"><span class="ico">⌖</span><b>探索機會</b><small>法律系導向 Activity Radar</small></button></div><div class="section-head"><h2>OPPORTUNITY SCOUTING</h2><small>公開活動資料</small></div>${homeOpportunityCards()}${homeReviewCenter()}${homeSystemHealth()}`;
    }else{
      home.innerHTML=`<section class="hero"><p class="eyebrow">TODAY'S GAME PLAN</p><h1>${todayMinutes()} MIN <span class="muted" style="font-size:.48em;font-weight:650">今日投入</span></h1><p>${next?`下一個具體行動：<b>${esc(next.name)}</b>${next.targetDate?` · ${esc(fmtDate(next.targetDate))}`:''}`:'目前具體行動都已完成，可以建立下一個訓練項目。'}</p><div class="hero-actions"><button class="btn primary" data-go="execute">開始訓練</button><button class="btn" data-open="backfillDialog">補登時間</button></div></section>
      <div class="section-head"><h2>WEEKLY STATS</h2><small>全部從 Study Log 即時計算</small></div><div class="grid three"><article class="card metric"><small>本週投入</small><strong>${weekMinutes()}</strong><span>分鐘</span></article><article class="card metric"><small>本週 Sessions</small><strong>${weekSessions()}</strong><span>次</span></article><article class="card metric"><small>連續投入</small><strong>${A.streakDays(state)}</strong><span>天</span></article></div>
      <div class="section-head"><h2>UP NEXT</h2><small>校曆＋個人行事＋目標日期</small></div><article class="card">${renderEventRows(timeline(5))}</article>
      <div class="section-head"><h2>OPPORTUNITY SCOUTING</h2><small>法律系導向</small></div>${homeOpportunityCards()}${homeReviewCenter()}${homeSystemHealth()}<div class="section-head"><h2>SEASON GOALS</h2><small>主要方向</small></div><div class="grid two">${roots.slice(0,4).map(r=>`<article class="card game-card"><h3>${esc(r.name)}</h3><div class="goal-meta">${Goals.progress(state,r.id)}% 完成</div><div class="progress"><span style="width:${Goals.progress(state,r.id)}%"></span></div></article>`).join('')}</div>`;
    }
    wireDynamic();
  }

  function homeOpportunityCards(){
    const x=opportunitySummary(),s=scholarshipSummary();
    return `<div class="grid two opportunity-home-grid"><article class="card scouting-home"><div><p class="eyebrow">SCOUTING REPORT</p><h3>${x.recommended?`${x.recommended} 個目前可推薦活動`:'活動資料載入中／目前無推薦'}</h3><p class="muted">${x.high} 個高度符合 · ${x.review} 個待複核 · ${x.resources} 個相關資源</p></div><button class="btn primary" data-go="opportunities">開啟活動雷達</button></article><article class="card scouting-home scholarship-home"><div><p class="eyebrow">SCHOLARSHIP BOARD</p><h3>${s.recommended?`${s.recommended} 個目前可推薦獎學金`:'獎學金資料載入中／目前無推薦'}</h3><p class="muted">專業考照 ${s.professional} · 外語能力 ${s.language} · 待複核 ${s.review}</p></div><button class="btn primary" data-go="scholarships">查看獎學金</button></article></div>`;
  }
  function activityMetaText(meta){
    const raw=String(meta?.updatedAt||'');if(!raw)return '公開資料';
    try{return `公開資料更新 ${new Intl.DateTimeFormat('zh-TW',{month:'numeric',day:'numeric'}).format(new Date(raw))}`}catch(_){return '公開資料'}
  }
  function activityCard(row){
    const when=row.date?fmtDate(row.date):(row.openEnded?'常設':'日期待確認');
    const deadline=row.deadline&&row.deadline!==row.date?` · 截止 ${fmtDate(row.deadline)}`:'';
    const reasons=row.fit.reasons.slice(0,3).map(x=>`<span class="reason-chip">${esc(x)}</span>`).join('');
    return `<article class="activity-card"><div class="activity-top"><div class="activity-chips"><span class="circle-chip circle-${esc(row.circleKey)}">${esc(row.circleLabel)}</span><span class="category-chip">${esc(row.categoryLabel)}</span></div><div class="match-score"><strong>${row.fit.score}</strong><small>${esc(row.fit.tierLabel)}</small></div></div><h3>${esc(row.title)}</h3><div class="activity-meta"><b>${esc(when)}</b>${esc(deadline)}${row.organizer?` · ${esc(row.organizer)}`:''}</div>${row.location?`<div class="activity-meta">${esc(row.location)}</div>`:''}<div class="reason-row">${reasons}</div><div class="activity-actions">${row.url?`<a class="btn primary" href="${esc(row.url)}" target="_blank" rel="noopener noreferrer">官方資訊</a>`:''}<details><summary>為什麼推薦</summary><div class="details-copy">${row.fit.reasons.map(x=>`<div>• ${esc(x)}</div>`).join('')||'依法律系 Profile、活動主題、距離與資料品質綜合判定。'}</div></details></div></article>`;
  }
  function reviewRow(row){return `<div class="review-row"><div><b>${esc(row.title)}</b><small>${esc(row.circleLabel)} · ${esc(row.categoryLabel)}${row.date?` · ${esc(fmtDate(row.date))}`:''}</small></div><span>${esc(row.qualityReason||'待複核')}</span></div>`}
  function resourceRow(row){return `<div class="resource-row"><div><b>${esc(row.title)}</b><small>${esc(row.source||row.organizer||'官方資源')}</small></div>${row.url?`<a class="btn" href="${esc(row.url)}" target="_blank" rel="noopener noreferrer">查看</a>`:''}</div>`}
  function visibleOpportunityBuckets(catalog=opportunityCatalog(),filters=activityFilters){return Opp.filterBuckets(catalog,filters)}
  function renderOpportunities(){
    const root=$('#pageOpportunities'),catalog=opportunityCatalog(),filters=activityFilters,visible=visibleOpportunityBuckets(catalog,filters),rows=visible.recommended,stats=Opp.stats(rows);
    root.innerHTML=`<div class="section-head scouting-head"><div><button class="back-link" data-go="home">← 首頁</button><p class="eyebrow">OPPORTUNITY SCOUTING</p><h2>活動雷達</h2></div><span class="version-chip">${esc(activityMetaText(catalog.meta))}</span></div><p class="muted">以東海法律系使用情境重新評分。校內只代表執行成本較低，不代表任何東海活動都會被高度推薦。</p>
    <div class="grid three scouting-kpis"><article class="card metric"><small>推薦活動</small><strong id="activityKpiRecommended">${visible.recommended.length}</strong><span>目前篩選結果</span></article><article class="card metric"><small>高度符合</small><strong id="activityKpiHigh">${visible.recommended.filter(x=>x.fit.tier==='high').length}</strong><span>80 分以上</span></article><article class="card metric"><small>待複核</small><strong id="activityKpiReview">${visible.review.length}</strong><span>目前篩選結果</span></article></div>
    <section class="card activity-filters"><div class="field search-field"><label for="activitySearch">搜尋</label><input id="activitySearch" value="${esc(filters.q)}" placeholder="活動、主題、承辦單位"></div><div class="filter-grid"><div class="field"><label for="activityCircle">圈層</label><select id="activityCircle"><option value="all">全部圈層</option>${Opp.CIRCLE_ORDER.map(k=>`<option value="${k}" ${filters.circle===k?'selected':''}>${esc(Opp.CIRCLES[k].label)}</option>`).join('')}</select></div><div class="field"><label for="activityCategory">類型</label><select id="activityCategory"><option value="all">全部類型</option>${Object.entries(Opp.CATEGORY_LABELS).map(([k,v])=>`<option value="${k}" ${filters.category===k?'selected':''}>${esc(v)}</option>`).join('')}</select></div><div class="field"><label for="activityTier">適配度</label><select id="activityTier"><option value="all">全部適配度</option>${Object.entries(Opp.TIER_LABELS).map(([k,v])=>`<option value="${k}" ${filters.tier===k?'selected':''}>${esc(v)}</option>`).join('')}</select></div></div></section>
    <div class="scope-strip">${[{key:'all',label:'全部'},...Opp.CIRCLE_ORDER.map(k=>({key:k,label:Opp.CIRCLES[k].label}))].map(x=>`<button class="scope-pill ${filters.circle===x.key?'active':''}" data-circle-pick="${x.key}">${esc(x.label)}</button>`).join('')}</div>
    <div class="activity-summary" id="activitySummary">目前 ${stats.total} 項 · 高度符合 ${stats.tiers.high} · 可能符合 ${stats.tiers.possible} · 探索 ${stats.tiers.explore}</div>
    <div class="section-head"><h2>推薦活動</h2><small>依目前篩選結果</small></div><div class="activity-list" id="activityResults">${rows.map(activityCard).join('')||'<div class="empty"><b>目前沒有符合篩選條件的推薦活動</b>可調整搜尋、圈層、類型或適配度。</div>'}</div>
    <details class="bucket-panel"><summary>待複核 <span id="activityReviewCount">${visible.review.length}</span></summary><div class="bucket-body" id="activityReviewBody">${visible.review.map(reviewRow).join('')||'<div class="muted">目前篩選條件下沒有待複核資料。</div>'}</div></details>
    <details class="bucket-panel"><summary>相關資源 <span id="activityResourceCount">${visible.resources.length}</span></summary><div class="bucket-body" id="activityResourceBody">${visible.resources.map(resourceRow).join('')||'<div class="muted">目前篩選條件下沒有相關資源。</div>'}</div></details>
    <div class="phase-note">已排除 ${catalog.archive.length} 筆過期／失效資料與 ${catalog.low.length} 筆低適配資料。</div>`;
    wireOpportunityControls();wireDynamic();
  }
  function refreshOpportunityResults(){
    const catalog=opportunityCatalog(),visible=visibleOpportunityBuckets(catalog,activityFilters),rows=visible.recommended,stats=Opp.stats(rows),summary=$('#activitySummary'),list=$('#activityResults');
    if(summary)summary.textContent=`目前 ${stats.total} 項 · 高度符合 ${stats.tiers.high} · 可能符合 ${stats.tiers.possible} · 探索 ${stats.tiers.explore}`;
    if(list)list.innerHTML=rows.map(activityCard).join('')||'<div class="empty"><b>目前沒有符合篩選條件的推薦活動</b>可調整搜尋、圈層、類型或適配度。</div>';
    const set=(sel,value)=>{const el=$(sel);if(el)el.textContent=String(value)};
    set('#activityKpiRecommended',visible.recommended.length);
    set('#activityKpiHigh',visible.recommended.filter(x=>x.fit.tier==='high').length);
    set('#activityKpiReview',visible.review.length);
    set('#activityReviewCount',visible.review.length);
    set('#activityResourceCount',visible.resources.length);
    const reviewBody=$('#activityReviewBody');if(reviewBody)reviewBody.innerHTML=visible.review.map(reviewRow).join('')||'<div class="muted">目前篩選條件下沒有待複核資料。</div>';
    const resourceBody=$('#activityResourceBody');if(resourceBody)resourceBody.innerHTML=visible.resources.map(resourceRow).join('')||'<div class="muted">目前篩選條件下沒有相關資源。</div>';
  }
  function wireOpportunityControls(){
    $('#activitySearch')?.addEventListener('input',e=>{activityFilters.q=e.target.value;refreshOpportunityResults()});
    $('#activityCircle')?.addEventListener('change',e=>{activityFilters.circle=e.target.value;renderOpportunities()});
    $('#activityCategory')?.addEventListener('change',e=>{activityFilters.category=e.target.value;renderOpportunities()});
    $('#activityTier')?.addEventListener('change',e=>{activityFilters.tier=e.target.value;renderOpportunities()});
    $$('[data-circle-pick]').forEach(b=>b.onclick=()=>{activityFilters.circle=b.dataset.circlePick;renderOpportunities()});
  }

  function scholarshipMetaText(meta){
    const raw=String(meta?.updatedAt||meta?.generatedAt||'');if(!raw)return '公開資料';
    try{return `公開資料更新 ${new Intl.DateTimeFormat('zh-TW',{month:'numeric',day:'numeric'}).format(new Date(raw))}`}catch(_){return '公開資料'}
  }
  function scholarshipCard(row){
    const reasons=row.fit.reasons.slice(0,3).map(x=>`<span class="reason-chip">${esc(x)}</span>`).join('');
    const deadline=row.deadline?fmtDate(row.deadline):'期限依官方公告';
    const amount=row.amount?` · ${esc(row.amount)} 元`:'';
    const badge=row.specialtyKind==='professional'?'PRO CERT':row.specialtyKind==='language'?'LANGUAGE':'SCHOLARSHIP';
    return `<article class="activity-card scholarship-card"><div class="activity-top"><div class="activity-chips"><span class="category-chip scholarship-kind-${esc(row.specialtyKind)}">${esc(row.specialtyLabel)}</span><span class="category-chip">${esc(badge)}</span></div><div class="match-score"><strong>${row.fit.score}</strong><small>${esc(row.fit.tierLabel)}</small></div></div><h3>${esc(row.title)}</h3><div class="activity-meta"><b>截止 ${esc(deadline)}</b>${amount}${row.source?` · ${esc(row.source)}`:''}</div>${row.eligibilityTarget?`<div class="scholarship-eligibility">${esc(row.eligibilityTarget==='general_student'?'一般在學學生':row.eligibilityTarget)}</div>`:''}<div class="reason-row">${reasons}</div><div class="activity-actions">${row.url?`<a class="btn primary" href="${esc(row.url)}" target="_blank" rel="noopener noreferrer">官方資訊</a>`:''}<details><summary>資格與推薦理由</summary><div class="details-copy"><div>✓ ${esc(row.eligibility.reason)}</div>${row.fit.reasons.map(x=>`<div>• ${esc(x)}</div>`).join('')}</div></details></div></article>`;
  }
  function scholarshipReviewRow(row){return `<div class="review-row"><div><b>${esc(row.title)}</b><small>${row.deadline?`截止 ${esc(fmtDate(row.deadline))} · `:''}${esc(row.source||'公開資料')}</small></div><span>${esc(row.eligibility?.reason||'資格待複核')}</span></div>`}
  function scholarshipResourceRow(row){return `<div class="resource-row"><div><b>${esc(row.title)}</b><small>${esc(row.source||'官方資源')}</small></div>${row.url?`<a class="btn" href="${esc(row.url)}" target="_blank" rel="noopener noreferrer">查看</a>`:''}</div>`}
  function scholarshipExclusionText(catalog){
    const stats=Sch.exclusionStats(catalog.excluded),entries=Object.entries(stats).sort((a,b)=>b[1]-a[1]);
    return entries.length?entries.map(([code,count])=>`<span class="policy-chip">${esc(Sch.CODE_LABELS[code]||code)} ${count}</span>`).join(''):'<span class="muted">目前沒有資格排除資料。</span>';
  }
  function renderScholarships(){
    const root=$('#pageScholarships'),catalog=scholarshipCatalog(),rows=Sch.filter(catalog.recommended,scholarshipFilters),stats=Sch.stats(rows),review=Sch.filter(catalog.review,scholarshipFilters),resources=Sch.filter(catalog.resources,scholarshipFilters);
    root.innerHTML=`<div class="section-head scouting-head"><div><button class="back-link" data-go="home">← 首頁</button><p class="eyebrow">SCHOLARSHIP BOARD</p><h2>獎學金</h2></div><span class="version-chip">${esc(scholarshipMetaText(catalog.meta))}</span></div><p class="muted">採嚴格資格模式：既有排除條件照舊；只要存在縣市／地域必要限制，一律不進推薦池。外語與專業考照只提高排序，不得抵銷硬性資格不符。</p>
    <div class="grid three scouting-kpis"><article class="card metric"><small>推薦獎學金</small><strong id="scholarshipKpiRecommended">${rows.length}</strong><span>目前篩選結果</span></article><article class="card metric"><small>專業考照</small><strong id="scholarshipKpiProfessional">${stats.specialty.professional}</strong><span>優先分類</span></article><article class="card metric"><small>外語能力</small><strong id="scholarshipKpiLanguage">${stats.specialty.language}</strong><span>優先分類</span></article></div>
    <section class="card activity-filters"><div class="field search-field"><label for="scholarshipSearch">搜尋</label><input id="scholarshipSearch" value="${esc(scholarshipFilters.q)}" placeholder="獎學金、來源、資格"></div><div class="filter-grid scholarship-filter-grid"><div class="field"><label for="scholarshipKind">類型</label><select id="scholarshipKind"><option value="all">全部類型</option>${Object.entries(Sch.SPECIALTY_LABELS).map(([k,v])=>`<option value="${k}" ${scholarshipFilters.kind===k?'selected':''}>${esc(v)}</option>`).join('')}</select></div><div class="field"><label for="scholarshipTier">推薦度</label><select id="scholarshipTier"><option value="all">全部推薦度</option><option value="high" ${scholarshipFilters.tier==='high'?'selected':''}>高度推薦</option><option value="possible" ${scholarshipFilters.tier==='possible'?'selected':''}>優先留意</option><option value="general" ${scholarshipFilters.tier==='general'?'selected':''}>一般推薦</option></select></div></div></section>
    <div class="activity-summary" id="scholarshipSummary">目前 ${stats.total} 項 · 高度推薦 ${stats.tiers.high} · 優先留意 ${stats.tiers.possible} · 一般推薦 ${stats.tiers.general}</div>
    <div class="section-head"><h2>推薦獎學金</h2><small>通過硬性資格後才進排序</small></div><div class="activity-list" id="scholarshipResults">${rows.map(scholarshipCard).join('')||'<div class="empty"><b>目前沒有符合條件的推薦獎學金</b>可調整搜尋或類型；硬性資格不符項目不會因篩選而重新進入推薦。</div>'}</div>
    <details class="bucket-panel"><summary>資格待複核 <span id="scholarshipReviewCount">${review.length}</span></summary><div class="bucket-body" id="scholarshipReviewBody">${review.map(scholarshipReviewRow).join('')||'<div class="muted">目前篩選條件下沒有待複核資料。</div>'}</div></details>
    <details class="bucket-panel"><summary>相關資源 <span id="scholarshipResourceCount">${resources.length}</span></summary><div class="bucket-body" id="scholarshipResourceBody">${resources.map(scholarshipResourceRow).join('')||'<div class="muted">目前篩選條件下沒有相關資源。</div>'}</div></details>
    <section class="card scholarship-policy-report"><div class="section-head"><h3>資格排除報告</h3><small>${catalog.excluded.length} 項不進推薦池</small></div><div class="policy-chip-row">${scholarshipExclusionText(catalog)}</div><p class="muted">排除項目不列出個別卡片；其中任何縣市／戶籍／設籍／居住／就讀地必要限制均直接排除。</p></section>
    <div class="phase-note">另有 ${catalog.archive.length} 筆已截止／失效／重複資料不列入推薦。</div>`;
    wireScholarshipControls();wireDynamic();
  }
  function refreshScholarshipResults(){
    const catalog=scholarshipCatalog(),rows=Sch.filter(catalog.recommended,scholarshipFilters),stats=Sch.stats(rows),review=Sch.filter(catalog.review,scholarshipFilters),resources=Sch.filter(catalog.resources,scholarshipFilters);
    const set=(sel,value)=>{const el=$(sel);if(el)el.textContent=String(value)};
    set('#scholarshipKpiRecommended',rows.length);set('#scholarshipKpiProfessional',stats.specialty.professional);set('#scholarshipKpiLanguage',stats.specialty.language);
    const summary=$('#scholarshipSummary');if(summary)summary.textContent=`目前 ${stats.total} 項 · 高度推薦 ${stats.tiers.high} · 優先留意 ${stats.tiers.possible} · 一般推薦 ${stats.tiers.general}`;
    const result=$('#scholarshipResults');if(result)result.innerHTML=rows.map(scholarshipCard).join('')||'<div class="empty"><b>目前沒有符合條件的推薦獎學金</b>可調整搜尋或類型；硬性資格不符項目不會因篩選而重新進入推薦。</div>';
    set('#scholarshipReviewCount',review.length);set('#scholarshipResourceCount',resources.length);
    const reviewBody=$('#scholarshipReviewBody');if(reviewBody)reviewBody.innerHTML=review.map(scholarshipReviewRow).join('')||'<div class="muted">目前篩選條件下沒有待複核資料。</div>';
    const resourceBody=$('#scholarshipResourceBody');if(resourceBody)resourceBody.innerHTML=resources.map(scholarshipResourceRow).join('')||'<div class="muted">目前篩選條件下沒有相關資源。</div>';
  }
  function wireScholarshipControls(){
    $('#scholarshipSearch')?.addEventListener('input',e=>{scholarshipFilters.q=e.target.value;refreshScholarshipResults()});
    $('#scholarshipKind')?.addEventListener('change',e=>{scholarshipFilters.kind=e.target.value;renderScholarships()});
    $('#scholarshipTier')?.addEventListener('change',e=>{scholarshipFilters.tier=e.target.value;renderScholarships()});
  }

  function goalTreeHtml(){
    const roots=Goals.roots(state);if(!roots.length)return `<div class="empty"><b>還沒有目標</b>建立第一組三層目標後，這裡會成為你的 Season Goals 地圖。<div style="margin-top:14px"><button class="btn primary" data-open="goalWizard">建立第一組目標</button></div></div>`;
    return roots.map(root=>{
      const stages=Goals.children(state,root.id),pct=Goals.progress(state,root.id);
      return `<section class="goal-root"><div class="goal-root-head"><div><p class="eyebrow">SEASON GOAL</p><h3>${esc(root.name)}</h3><div class="goal-meta">${pct}% 完成${root.targetDate?` · ${esc(fmtDate(root.targetDate))}`:''}</div><div class="progress"><span style="width:${pct}%"></span></div></div><div class="actions"><button class="icon-btn" data-edit-goal="${esc(root.id)}" title="編輯">✎</button><button class="btn" data-add-level="2" data-parent="${esc(root.id)}">＋ 階段</button><button class="icon-btn" data-delete-goal="${esc(root.id)}" title="刪除">⌫</button></div></div>
      ${stages.map(stage=>{const acts=Goals.children(state,stage.id);return `<div class="goal-stage"><div class="goal-stage-head"><div><span class="eyebrow">MILESTONE</span><b>${esc(stage.name)}</b><div class="goal-meta">${Goals.progress(state,stage.id)}%${stage.targetDate?` · ${esc(fmtDate(stage.targetDate))}`:''}</div></div><div><button class="icon-btn" data-edit-goal="${esc(stage.id)}">✎</button><button class="btn" data-add-level="3" data-parent="${esc(stage.id)}">＋ 行動</button><button class="icon-btn" data-delete-goal="${esc(stage.id)}">⌫</button></div></div><div class="goal-actions">${acts.map(a=>`<div class="goal-action ${a.status==='done'?'done':''}"><button class="check" data-toggle-action="${esc(a.id)}">${a.status==='done'?'✓':''}</button><div><div class="goal-action-name">${esc(a.name)}</div><div class="goal-meta">TRAINING${a.targetDate?` · ${esc(fmtDate(a.targetDate))}`:''}</div></div><div><button class="icon-btn" data-edit-goal="${esc(a.id)}">✎</button><button class="icon-btn" data-delete-goal="${esc(a.id)}">⌫</button></div></div>`).join('')||'<div class="goal-meta">尚無具體行動</div>'}</div></div>`}).join('')||'<div class="goal-stage"><div class="goal-meta">尚無階段目標</div></div>'}</section>`;
    }).join('');
  }
  function renderGoals(){$('#pageGoals').innerHTML=`<div class="section-head"><div><p class="eyebrow">SEASON GOALS</p><h2>三層目標地圖</h2></div><button class="btn primary" data-add-level="1">＋ 新方向</button></div><p class="muted">方向 → 階段目標 → 具體行動。可為任何層設定目標／安排日期；正式資料不建立 Level 4。</p>${goalTreeHtml()}`;wireDynamic()}

  function renderExecute(){
    const actions=Goals.actions(state),timer=state.timer,active=timer.status!=='idle',selected=currentAction();
    $('#pageExecute').innerHTML=`<div class="section-head"><div><p class="eyebrow">TRAINING SESSION</p><h2>執行</h2></div><button class="btn" data-open="backfillDialog">＋ 補登</button></div>
    <section class="scoreboard"><div class="scoreboard-label">SCOREBOARD</div><div class="timer-display" id="timerDisplay">${fmtClock(Timer.elapsedMs(timer))}</div><div class="timer-target">${active?esc(timer.label):'選擇一項訓練，或直接自由計時'}</div><div class="timer-path">${selected?esc(Goals.pathText(state,selected.id)):(timer.mode==='free'?'OTHER STUDY':'')}</div><div class="timer-controls">${timer.status==='idle'?`<button class="btn primary" data-start-selected>開始</button>`:''}${timer.status==='running'?`<button class="btn" data-pause-timer>暫停</button><button class="btn primary" data-complete-timer>完成</button><button class="btn danger" data-cancel-timer>取消</button>`:''}${timer.status==='paused'?`<button class="btn primary" data-resume-timer>繼續</button><button class="btn" data-complete-timer>完成</button><button class="btn danger" data-cancel-timer>取消</button>`:''}</div></section>
    ${timer.status==='idle'?`<div class="section-head"><h2>選擇訓練</h2><small>也可不綁目標</small></div><div class="card form-grid"><div class="field"><label>具體行動</label><select id="executionTarget"><option value="free">自由計時／其他讀書</option>${actions.filter(a=>a.status!=='done').map(a=>`<option value="${esc(a.id)}">${esc(Goals.pathText(state,a.id))}</option>`).join('')}</select></div><div class="field"><label>本次名稱</label><input id="executionLabel" placeholder="自由計時可自訂名稱，例如：課堂複習"></div></div>`:''}
    <div class="section-head"><h2>RECENT SESSIONS</h2><small>Timer 與補登共用同一 Study Log</small></div><article class="card">${(state.studyLogs||[]).slice(-8).reverse().map(log=>`<div class="event-row"><div class="event-date">${Math.round((Number(log.durationSeconds)||0)/60)} MIN</div><div><div class="event-title">${esc(log.label)}</div><div class="event-meta">${new Date(log.endedAt||log.createdAt).toLocaleString('zh-TW')} · ${log.source==='manual'?'補登':'計時'}</div>${log.actionId?`<span class="event-badge">${esc(Goals.pathText(state,log.actionId)||'目標紀錄')}</span>`:'<span class="event-badge">其他讀書</span>'}</div></div>`).join('')||'<div class="empty">尚無實際投入紀錄</div>'}</article>`;
    wireDynamic();updateTick();
  }

  function renderCalendar(){
    const today=A.dayKey(new Date()),school=schoolCalendar.filter(e=>e.date>=today).map(e=>({...e,kind:'school',badge:'東海校曆'})),personal=(state.personalEvents||[]).filter(e=>e.date>=today).map(e=>({...e,kind:'personal',badge:'個人'})),goalDates=Goals.datedGoals(state,today).map(g=>({id:'goal-'+g.id,date:g.targetDate,title:g.name,meta:Goals.pathText(state,g.id),kind:'goal',badge:g.level===3?'具體行動':'目標日期'})),all=[...school,...personal,...goalDates].sort((a,b)=>a.date.localeCompare(b.date));
    $('#pageCalendar').innerHTML=`<div class="section-head"><div><p class="eyebrow">SCHEDULE</p><h2>行事曆</h2></div><button class="btn primary" data-open="personalEventDialog">＋ 個人行事</button></div><div class="grid three"><article class="card metric"><small>東海官方校曆</small><strong>${schoolCalendar.length}</strong><span>公開事件</span></article><article class="card metric"><small>個人行事</small><strong>${state.personalEvents.length}</strong><span>獨立資料</span></article><article class="card metric"><small>目標日期</small><strong>${Goals.datedGoals(state).length}</strong><span>由 Goal 計算</span></article></div><div class="phase-note">校曆與目標日期只用於 Schedule；分析頁只統計 Study Log，不會把校曆事件算成讀書時間。</div><div class="section-head"><h2>UPCOMING</h2><small>接下來的行程</small></div><article class="card calendar-strip">${renderEventRows(all.slice(0,24))}</article>`;wireDynamic();
  }

  function renderAnalytics(){
    const week=A.dailyWeek(state),max=Math.max(1,...week.map(d=>d.minutes)),roots=Goals.roots(state),dirs=A.directionStats(state,A.weekLogs(state));
    $('#pageAnalytics').innerHTML=`<div class="section-head"><div><p class="eyebrow">PLAYER STATS</p><h2>分析</h2></div><span class="version-chip">LIVE</span></div><div class="grid three"><article class="card metric"><small>總投入</small><strong>${totalMinutes()}</strong><span>分鐘</span></article><article class="card metric"><small>本週投入</small><strong>${weekMinutes()}</strong><span>分鐘</span></article><article class="card metric"><small>本週 Sessions</small><strong>${weekSessions()}</strong><span>次</span></article></div>
    <div class="section-head"><h2>MINUTES BY DAY</h2><small>本週</small></div><article class="card"><div class="week-bars">${week.map(d=>`<div class="day-bar"><div class="bar-rail"><div class="bar-fill" style="height:${Math.max(2,Math.round(d.minutes/max*100))}%"></div></div><b>${d.minutes}</b><small>${d.label}</small></div>`).join('')}</div></article>
    <div class="section-head"><h2>MINUTES BY GOAL</h2><small>本週，依 Study Log 的 actionId 回推</small></div><div class="grid two">${dirs.map(d=>`<article class="card"><h3>${esc(d.name)}</h3><div class="stat-inline"><b>${d.minutes} MIN</b><span>${d.sessions} sessions</span></div>${A.milestoneStats(state,d.id,A.weekLogs(state)).map(m=>`<div class="mini-stat"><span>${esc(m.name)}</span><b>${m.minutes}m</b></div>`).join('')}</article>`).join('')||'<div class="empty">本週尚無綁定目標的投入</div>'}</div>
    <div class="section-head"><h2>SEASON PROGRESS</h2><small>由具體行動完成狀態回推</small></div><div class="grid two">${roots.map(r=>`<article class="card"><h3>${esc(r.name)}</h3><div class="goal-meta">${Goals.progress(state,r.id)}%</div><div class="progress"><span style="width:${Goals.progress(state,r.id)}%"></span></div></article>`).join('')||'<div class="empty">建立目標後會顯示方向進度</div>'}</div>`;
  }


  function reviewDecisionLabel(decision){
    if(!decision)return '自動待複核';
    return decision.action==='approve'?'人工核准':decision.action==='exclude'?'人工排除':'維持待複核';
  }
  function reviewWorkbenchRow(kind,row){
    const d=Review.get(state.reviewDecisions||{},kind,row.id),reason=kind==='activity'?(row.qualityReason||'來源待複核'):(row.eligibility?.reason||'資格待複核');
    const meta=kind==='activity'?`${row.circleLabel||''}${row.categoryLabel?` · ${row.categoryLabel}`:''}${row.date?` · ${fmtDate(row.date)}`:''}`:`${row.deadline?`截止 ${fmtDate(row.deadline)} · `:''}${row.source||'公開資料'}`;
    const tone=d?.action==='approve'?'decision-approved':d?.action==='exclude'?'decision-excluded':d?.action==='pending'?'decision-pending':'';
    return `<article class="card review-work-item ${tone}"><div class="review-work-head"><div><span class="category-chip">${kind==='activity'?'ACTIVITY':'SCHOLARSHIP'}</span><h3>${esc(row.title)}</h3><p class="muted">${esc(meta)}</p></div><span class="review-state">${esc(reviewDecisionLabel(d))}</span></div><div class="review-reason">${esc(reason)}</div><div class="review-work-actions">${row.url?`<a class="btn" href="${esc(row.url)}" target="_blank" rel="noopener noreferrer">官方資訊</a>`:''}<button class="btn primary" data-review-action="approve" data-review-kind="${kind}" data-review-id="${esc(row.id)}" data-review-title="${esc(row.title)}">核准推薦</button><button class="btn danger" data-review-action="exclude" data-review-kind="${kind}" data-review-id="${esc(row.id)}" data-review-title="${esc(row.title)}">排除</button><button class="btn" data-review-action="pending" data-review-kind="${kind}" data-review-id="${esc(row.id)}" data-review-title="${esc(row.title)}">維持待複核</button>${d?`<button class="btn" data-review-action="reset" data-review-kind="${kind}" data-review-id="${esc(row.id)}" data-review-title="${esc(row.title)}">恢復自動判定</button>`:''}</div></article>`;
  }
  function renderReview(){
    const root=$('#pageReview'),autoA=opportunityAutoCatalog(),autoS=scholarshipAutoCatalog(),decisions=Review.normalize(state.reviewDecisions||{}),stats=Review.stats(decisions);
    const aRows=autoA.review||[],sRows=autoS.review||[],unresolved=[...aRows.map(x=>['activity',x]),...sRows.map(x=>['scholarship',x])].filter(([kind,row])=>{const d=Review.get(decisions,kind,row.id);return !d||d.action==='pending'}).length;
    const history=Object.values(decisions).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
    root.innerHTML=`<div class="section-head scouting-head"><div><button class="back-link" data-go="home">← 首頁</button><p class="eyebrow">REVIEW CENTER</p><h2>人工審查工作台</h2></div><span class="version-chip">${unresolved} 待處理</span></div>
    <p class="muted">只允許人工處理「自動待複核」項目。獎學金已被硬性資格規則排除的項目不會出現在這裡，也不能靠人工核准繞過縣市、清寒、科系等硬性規則。</p>
    <div class="grid three review-kpis"><article class="card metric"><small>自動待複核</small><strong>${aRows.length+sRows.length}</strong><span>活動 ${aRows.length} · 獎學金 ${sRows.length}</span></article><article class="card metric"><small>仍待處理</small><strong>${unresolved}</strong><span>未決定或刻意保留</span></article><article class="card metric"><small>人工決策</small><strong>${stats.approve+stats.exclude}</strong><span>核准 ${stats.approve} · 排除 ${stats.exclude}</span></article></div>
    <article class="card review-policy"><div><b>決策保存方式</b><p class="muted">人工決策保存在這個 Basketball Goal Manager 的獨立個人資料中；AutoFetch 更新 catalog 後，只要同一 ID 仍存在就會自動套用。可匯出／匯入 JSON 備份。</p></div><div class="hero-actions"><button class="btn" data-review-export>匯出審查決策</button><button class="btn" data-review-import>匯入審查決策</button><input id="reviewImportInput" type="file" accept="application/json,.json" hidden></div></article>
    <div class="section-head"><h2>ACTIVITY REVIEW</h2><small>${aRows.length} 筆自動待複核</small></div><div class="review-work-list">${aRows.map(x=>reviewWorkbenchRow('activity',x)).join('')||'<div class="empty">目前沒有活動待複核。</div>'}</div>
    <div class="section-head"><h2>SCHOLARSHIP REVIEW</h2><small>${sRows.length} 筆資格／來源待複核</small></div><div class="review-work-list">${sRows.map(x=>reviewWorkbenchRow('scholarship',x)).join('')||'<div class="empty">目前沒有獎學金待複核。</div>'}</div>
    <details class="bucket-panel"><summary>審查決策紀錄 <span>${history.length}</span></summary><div class="bucket-body">${history.map(d=>`<div class="review-row"><div><b>${esc(d.title||d.id)}</b><small>${d.kind==='activity'?'活動':'獎學金'} · ${esc(d.updatedAt?new Date(d.updatedAt).toLocaleString('zh-TW'):'')}</small></div><span>${esc(reviewDecisionLabel(d))}</span></div>`).join('')||'<div class="muted">尚無人工審查決策。</div>'}</div></details>`;
    wireDynamic();
  }


  function healthCard(title,item,extra=''){
    const age=item.updatedAt?` · ${esc(Health.formatAge(item.ageHours))}`:'';
    const count=item.count===null||item.count===undefined?'—':item.count;
    return `<article class="card health-card"><div class="health-card-head"><div><p class="eyebrow">${esc(title)}</p><h3>${count} 筆</h3></div><span class="health-pill ${healthToneClass(item.tone)}">${esc(item.label)}</span></div><p class="muted">${esc(item.sourceText||item.detail||'')}${age}</p>${extra}</article>`;
  }
  function renderSystem(){
    const root=$('#pageSystem'),data=publicHealth(),pwa=pwaHealth(),raw=systemPwaStatus||{};
    const release=raw.release||{};
    root.innerHTML=`<div class="section-head scouting-head"><div><button class="back-link" data-go="home">← 首頁</button><p class="eyebrow">SYSTEM HEALTH</p><h2>資料與版本狀態</h2></div><span class="version-chip">v${esc(C.version)}</span></div>
    <section class="health-banner ${healthToneClass(data.summary.tone)}"><div><b>${esc(data.summary.label)}</b><p>資料讀取失敗會直接顯示錯誤，不再以 0/0 偽裝成來源統計。</p></div><button class="btn" data-health-refresh>重新檢查</button></section>
    <div class="grid three health-grid">${healthCard('ACTIVITY DATA',data.activity,data.activity.review!==undefined?`<div class="mini-stat"><span>待複核</span><b>${data.activity.review}</b></div>`:'')}${healthCard('SCHOLARSHIP DATA',data.scholarship,`<div class="mini-stat"><span>資格驗證</span><b>${data.scholarship.verified??'—'}</b></div><div class="mini-stat"><span>待驗證</span><b>${data.scholarship.unverified??'—'}</b></div>`)}${healthCard('THU CALENDAR',data.calendar,data.calendar.sourceAnnouncementUrl?`<div class="mini-stat"><span>來源</span><b><a href="${esc(data.calendar.sourceAnnouncementUrl)}" target="_blank" rel="noopener noreferrer">官方公告</a></b></div>`:'')}</div>
    <div class="section-head"><h2>PWA / RELEASE</h2><small>page · worker · published release</small></div><article class="card release-card"><div class="health-card-head"><div><p class="eyebrow">VERSION COHERENCE</p><h3>${esc(pwa.label)}</h3></div><span class="health-pill ${healthToneClass(pwa.tone)}">${esc(pwa.status.toUpperCase())}</span></div><div class="release-rows"><div><span>頁面</span><b>${esc(pwa.pageVersion||C.version)}</b></div><div><span>Service Worker</span><b>${esc(pwa.workerVersion||'尚未回報')}</b></div><div><span>發布版本</span><b>${esc(pwa.releaseVersion||'尚未讀取')}</b></div><div><span>網路</span><b>${pwa.status==='offline'?'離線':'在線'}</b></div></div>${raw.waiting?'<p class="health-note">已有新版 Service Worker 等待啟用；完成中的 Timer 不會被自動中斷。</p>':''}<div class="hero-actions"><button class="btn primary" data-health-refresh>檢查更新</button><button class="btn" data-reload-app>重新載入</button></div></article>
    <div class="section-head"><h2>AUTO DATA</h2><small>GitHub Actions</small></div><article class="card"><div class="status-line"><span class="dot"></span><b>${release.autofetch?.enabled===true?'AutoFetch 已設定':'AutoFetch 狀態待確認'}</b></div><p class="muted">活動、獎學金與東海校曆皆由獨立 updater 更新；網站只讀取產出的 JSON，再由本網站自己的 policy 重新分類。失敗時會主動建立 GitHub Alert Issue。</p><div class="mini-stat"><span>活動／獎學金排程</span><b>${release.autofetch?.schedule==='daily-twice'?'每日兩次':'—'}</b></div><div class="mini-stat"><span>校曆排程</span><b>${release.autofetch?.calendarSchedule==='daily-once'?'每日一次':'—'}</b></div><div class="mini-stat"><span>失敗通知</span><b>${release.autofetch?.failureAlerts==='github-issue'?'GitHub Issue 主動告警':'—'}</b></div><div class="mini-stat"><span>資料過舊門檻</span><b>${release.autofetch?.staleAfterHours||Health.STALE_HOURS} 小時</b></div></article>
    <div class="section-head"><h2>REVIEW GOVERNANCE</h2><small>人工決策只作用於自動待複核</small></div><article class="card"><div class="status-line"><span class="dot"></span><b>Review Center 已啟用</b></div><p class="muted">人工核准／排除會保存在此網站的獨立使用者資料中；硬性資格排除不會被人工審查覆蓋。</p><div class="hero-actions"><button class="btn primary" data-go="review">開啟審查中心</button></div></article><div class="phase-note">公開資料與個人資料完全分離。AutoFetch 只會更新 repository 內的公開 catalog，不會接觸 localStorage、IndexedDB、目標、Timer 或 Study Log。</div>`;
    wireDynamic();
  }
  async function refreshSystemStatus(){
    try{systemPwaStatus=await window.GMBPWA?.check();if(page==='system')renderSystem();else renderCurrent();toast('狀態已重新檢查')}catch(err){toast('版本檢查失敗：'+String(err?.message||err))}
  }

  function renderCurrent(){if(page==='home')renderHome();else if(page==='goals')renderGoals();else if(page==='execute')renderExecute();else if(page==='calendar')renderCalendar();else if(page==='analytics')renderAnalytics();else if(page==='opportunities')renderOpportunities();else if(page==='scholarships')renderScholarships();else if(page==='review')renderReview();else if(page==='system')renderSystem()}
  function openAddGoal(level,parentId){const labels={1:['新增方向','方向名稱'],2:['新增階段目標','階段目標名稱'],3:['新增具體行動','具體行動名稱']};$('#goalAddLevel').value=String(level);$('#goalAddParent').value=parentId||'';$('#goalAddTitle').textContent=labels[level][0];$('#goalAddLabel').textContent=labels[level][1];$('#goalAddName').value='';$('#goalAddDate').value='';$('#goalAddDialog').showModal();setTimeout(()=>$('#goalAddName').focus(),40)}
  function openEditGoal(id){const g=Goals.byId(state,id);if(!g)return;$('#goalEditId').value=g.id;$('#goalEditName').value=g.name;$('#goalEditDate').value=g.targetDate||'';$('#goalEditDialog').showModal()}
  function openBackfill(){const sel=$('#backfillTarget');sel.innerHTML='<option value="free">其他讀書時間</option>'+Goals.actions(state).map(a=>`<option value="${esc(a.id)}">${esc(Goals.pathText(state,a.id))}</option>`).join('');$('#backfillDate').value=A.dayKey(new Date());$('#backfillMinutes').value='';$('#backfillLabel').value='';$('#backfillDialog').showModal()}

  function wireDynamic(){
    $$('[data-go]').forEach(b=>b.onclick=()=>nav(b.dataset.go));
    $$('[data-health-refresh]').forEach(b=>b.onclick=()=>void refreshSystemStatus());
    $$('[data-reload-app]').forEach(b=>b.onclick=()=>location.reload());
    $$('[data-review-action]').forEach(b=>b.onclick=()=>{try{const action=b.dataset.reviewAction,kind=b.dataset.reviewKind,id=b.dataset.reviewId,title=b.dataset.reviewTitle||'';state.reviewDecisions=Review.set(state.reviewDecisions||{},{kind,id,action,title});save();renderReview();toast(action==='approve'?'已人工核准':action==='exclude'?'已人工排除':action==='reset'?'已恢復自動判定':'已保留待複核')}catch(err){toast(String(err?.message||err))}});
    $('[data-review-export]')?.addEventListener('click',()=>downloadJson(`gmb-review-decisions-${A.dayKey(new Date())}.json`,Review.exportPayload(state.reviewDecisions||{})));
    $('[data-review-import]')?.addEventListener('click',()=>$('#reviewImportInput')?.click());
    $('#reviewImportInput')?.addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{const payload=JSON.parse(await file.text());state.reviewDecisions=Review.importPayload(payload);save();renderReview();toast('審查決策已匯入')}catch(err){toast('匯入失敗：'+String(err?.message||err))}});
    $$('[data-open]').forEach(b=>b.onclick=()=>b.dataset.open==='backfillDialog'?openBackfill():$('#'+b.dataset.open)?.showModal());
    $$('[data-add-level]').forEach(b=>b.onclick=()=>openAddGoal(Number(b.dataset.addLevel),b.dataset.parent||null));
    $$('[data-edit-goal]').forEach(b=>b.onclick=()=>openEditGoal(b.dataset.editGoal));
    $$('[data-toggle-action]').forEach(b=>b.onclick=()=>{const g=Goals.byId(state,b.dataset.toggleAction);const done=g.status!=='done';state=Goals.setCompleted(state,g.id,done);save();renderCurrent();toast(done?'具體行動已完成':'已重新開啟')});
    $$('[data-delete-goal]').forEach(b=>b.onclick=()=>{const g=Goals.byId(state,b.dataset.deleteGoal);if(g&&confirm(`刪除「${g.name}」及其所有下層？`)){state=Goals.removeGoal(state,g.id);save();renderCurrent();toast('已刪除目標')}});
    $$('[data-delete-event]').forEach(b=>b.onclick=()=>{state.personalEvents=state.personalEvents.filter(e=>String(e.id)!==String(b.dataset.deleteEvent));save();renderCalendar();toast('已刪除個人行事')});
    $('[data-start-selected]')?.addEventListener('click',()=>{const value=$('#executionTarget')?.value||'free',custom=String($('#executionLabel')?.value||'').trim();if(value==='free')state=Timer.start(state,{mode:'free',label:custom||'自由計時'});else{const action=Goals.byId(state,value);if(!action)return;state=Timer.start(state,{mode:'goal',actionId:action.id,label:custom||action.name})}save();renderExecute();toast('計時開始')});
    $('[data-pause-timer]')?.addEventListener('click',()=>{state=Timer.pause(state);save();renderExecute();toast('已暫停')});
    $('[data-resume-timer]')?.addEventListener('click',()=>{state=Timer.resume(state);save();renderExecute();toast('繼續計時')});
    $('[data-cancel-timer]')?.addEventListener('click',()=>{if(confirm('取消本次計時？本次時間不會寫入紀錄。')){state=Timer.cancel(state);save();renderExecute();toast('已取消')}});
    $('[data-complete-timer]')?.addEventListener('click',()=>{try{const r=Timer.complete(state);state=r.state;save();renderExecute();toast(`完成 ${Math.max(1,Math.round(r.log.durationSeconds/60))} 分鐘`)}catch(err){toast(err.message)}});
  }
  function updateTick(){clearInterval(tickHandle);tickHandle=null;const el=$('#timerDisplay');if(!el)return;const paint=()=>{if(page==='execute'&&state.timer.status==='running')el.textContent=fmtClock(Timer.elapsedMs(state.timer))};paint();if(state.timer.status==='running')tickHandle=setInterval(paint,250)}

  function bindStatic(){
    $$('.nav-btn').forEach(b=>b.addEventListener('click',()=>nav(b.dataset.nav)));$$('[data-close-dialog]').forEach(b=>b.addEventListener('click',()=>$('#'+b.dataset.closeDialog)?.close()));
    $('#goalWizardForm').addEventListener('submit',e=>{e.preventDefault();try{state=Goals.createPath(state,{direction:$('#directionName').value,milestone:$('#milestoneName').value,action:$('#actionName').value});state.settings.onboardingComplete=true;save();$('#goalWizard').close();e.target.reset();nav('goals');toast('第一組目標已建立')}catch(err){toast(err.message)}});
    $('#goalAddForm').addEventListener('submit',e=>{e.preventDefault();try{state=Goals.addGoal(state,{name:$('#goalAddName').value,level:Number($('#goalAddLevel').value),parentId:$('#goalAddParent').value||null,targetDate:$('#goalAddDate').value});save();$('#goalAddDialog').close();renderGoals();toast('已新增目標')}catch(err){toast(err.message)}});
    $('#goalEditForm').addEventListener('submit',e=>{e.preventDefault();try{state=Goals.updateGoal(state,$('#goalEditId').value,{name:$('#goalEditName').value,targetDate:$('#goalEditDate').value});save();$('#goalEditDialog').close();renderGoals();toast('已儲存變更')}catch(err){toast(err.message)}});
    $('#backfillForm').addEventListener('submit',e=>{e.preventDefault();try{const target=$('#backfillTarget').value,r=Logs.manual(state,{actionId:target==='free'?null:target,label:$('#backfillLabel').value,minutes:$('#backfillMinutes').value,date:$('#backfillDate').value});state=r.state;save();$('#backfillDialog').close();renderCurrent();toast(`已補登 ${Math.round(r.log.durationSeconds/60)} 分鐘`)}catch(err){toast(err.message)}});
    $('#personalEventForm').addEventListener('submit',e=>{e.preventDefault();const date=$('#personalEventDate').value,title=$('#personalEventTitle').value.trim();if(!date||!title)return;state.personalEvents.push({id:'pe-'+Date.now().toString(36),date,title,meta:'個人行事'});save();$('#personalEventDialog').close();e.target.reset();renderCalendar();toast('已加入個人行事')});
  }
  async function loadPublicData(){
    const fetchJson=async(url,key)=>{try{const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);const data=await r.json();publicLoadStatus[key]={ok:true,error:''};return data}catch(err){publicLoadStatus[key]={ok:false,error:String(err?.message||err)};throw err}};
    const [cal,calMeta,acts,sch]=await Promise.allSettled([fetchJson('./data/school-calendar.json','calendar'),fetchJson('./data/school-calendar-meta.json','calendarMeta'),fetchJson('./data/activities.json','activity'),fetchJson('./data/scholarships.json','scholarship')]);
    schoolCalendar=cal.status==='fulfilled'&&Array.isArray(cal.value)?cal.value:[];
    schoolCalendarMeta=calMeta.status==='fulfilled'&&calMeta.value&&typeof calMeta.value==='object'?calMeta.value:{};
    activityPayload=acts.status==='fulfilled'&&acts.value&&typeof acts.value==='object'?acts.value:{meta:{},events:[]};
    scholarshipPayload=sch.status==='fulfilled'&&sch.value&&typeof sch.value==='object'?sch.value:{meta:{},scholarships:[]};
    renderCurrent();
  }
  async function init(){
    $('#versionChip').textContent='v'+C.version;bindStatic();
    const recovery=await Store.recoverIfNeeded();state=Store.load();renderCurrent();await loadPublicData();
    await window.GMBPWA?.register();
    try{systemPwaStatus=await window.GMBPWA?.check();if(page==='system'||page==='home')renderCurrent()}catch(_){}
    if(recovery.recovered)toast(`資料已由 ${recovery.source==='indexeddb'?'IndexedDB':'備份'} 恢復`);
    console.info('[Basketball Goal Manager]',{version:C.version,namespace:Store.namespaceReport(),profile:state.profile,recovery,publicLoadStatus,systemPwaStatus});
  }
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){state=Store.load();renderCurrent()}});
  init();
})();
