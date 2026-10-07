# Basketball Goal Manager

獨立於原 Goal Manager 的新網站專案。這不是第二使用者模式；它有自己的 PWA、Cache、localStorage 與 IndexedDB namespace。

## 目前版本

`0.9.1` — Automation & Review: THU Calendar AutoFetch, Review Center, proactive workflow alerts

本版完成公開資料自動更新、資料健康狀態、PWA 版本一致性與 GitHub Pages 發布前檢查。

### AutoFetch

- 將原系統已驗證的「公開資料抓取器」獨立移入新網站的 `tools/autofetch/`
- Activity 與 Scholarship 每日排程兩次更新
- AutoFetch **只更新 repository 內的公開 JSON catalog**
- 不接觸 localStorage、IndexedDB、目標、Timer、Study Log 或私人行事
- 更新後會先跑新網站自己的 Activity / Scholarship regression tests，再允許 commit
- catalog 大幅縮水、ID 重複、來源全失敗或資料過舊會讓 workflow 失敗，不會靜默發布壞資料

### Data Health

首頁新增 `SYSTEM HEALTH`，子頁會明確顯示：

- Activity 資料更新時間、來源健康數、目前筆數、待複核數
- Scholarship 資料更新時間、來源類別健康數、資格已驗證／待驗證數
- 東海校曆是否載入
- 36 小時以上未更新顯示「資料過舊」
- fetch 失敗顯示「無法讀取」，**不再以 0/0 偽裝成來源統計**

### PWA / Release coherence

- Page version / Service Worker version / published `release.json` 版本同頁比對
- Service Worker 註冊使用 `updateViaCache: 'none'`
- navigation、JS、CSS、JSON 使用 network-first
- 若 published release 較新或 worker 與 page 不一致，系統狀態會直接標示
- 不會為了更新而自動中斷正在執行的 Timer

### Scholarship 小型 Parking-Lot 清理

- `general_student` 改成人類可讀的「一般在學學生」
- 「可申請」推薦層級改名為「一般推薦」，避免誤解

## Namespace

- localStorage data: `gmb-law:v1:state`
- localStorage timer: `gmb-law:v1:timer`
- backup: `gmb-law:v1:backup`
- IndexedDB: `goal-manager-basketball-law-v1`
- Service Worker cache: `gmb-law:pwa:*`
- PWA id: `/goal-manager-basketball-law/`

## 驗證

```bash
bash scripts/verify.sh
bash scripts/release-preflight.sh
```

`check-public-data.js` 預設只檢查結構；AutoFetch 完成後會使用 `--strict-freshness` 要求 Activity / Scholarship 在 36 小時內更新。

## 本地預覽

```bash
python -m http.server 8081 --directory ~/goal-manager-basketball-law
```

瀏覽：

```text
http://127.0.0.1:8081/index.html?v=060
```

## 正式部署

專案已準備 GitHub Pages workflow。請看 `DEPLOY.md`。

## 開發主線

目前已完成：

1. 獨立網站／PWA／Storage namespace
2. 三層 Goal Core Loop
3. Opportunity Scouting
4. Scholarship Eligibility
5. AutoFetch / Data Health / PWA release coherence

下一階段是正式 GitHub repository / GitHub Pages 上線與整體手機 acceptance，不再加入新的核心模組。


## v0.9.1 Automation & Review

- Public Activity and Scholarship catalogs: twice-daily AutoFetch.
- THU official academic calendar: daily AutoFetch from the newest official calendar announcement/PDF.
- AutoFetch failure: creates/updates a GitHub Issue; a later successful run closes it.
- Review Center: approve, exclude, or deliberately keep automatic review items pending. Decisions stay in the isolated PWA user state and can be exported/imported.
- Hard Scholarship exclusions are never bypassed by manual review.
