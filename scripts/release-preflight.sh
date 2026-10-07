#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)";cd "$ROOT"
echo "== Basketball Goal Manager release preflight =="
bash scripts/verify.sh
node scripts/check-public-data.js
node - <<'NODE'
const fs=require('fs');
const vm=require('vm');
const src=fs.readFileSync('config/app-config.js','utf8');
const ctx={globalThis:{}};vm.createContext(ctx);vm.runInContext(src,ctx);
const config=ctx.globalThis.GMB_CONFIG;
const release=JSON.parse(fs.readFileSync('release.json','utf8'));
const sw=fs.readFileSync('sw.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const manifest=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));
if(config.version!==release.version)throw new Error(`version mismatch config=${config.version} release=${release.version}`);
if(!sw.includes(`const VERSION='${config.version}'`))throw new Error('service worker version mismatch');
if(!html.includes(`app-config.js?v=${config.version}`))throw new Error('HTML asset version mismatch');
if(manifest.id!==config.pwa.manifestId)throw new Error('manifest id mismatch');
if(release.autofetch?.enabled!==true)throw new Error('release metadata says AutoFetch disabled');
if(release.autofetch?.calendar!==true)throw new Error('release metadata says calendar AutoFetch disabled');
if(release.autofetch?.failureAlerts!=='github-issue')throw new Error('release metadata missing failure alerts');
console.log('RELEASE_CONTRACT_OK',config.version,manifest.id);
NODE
python -m json.tool release.json >/dev/null
python -m json.tool tools/autofetch/sources.json >/dev/null
python -m json.tool tools/autofetch/scholarship-sources.json >/dev/null
python -m json.tool data/school-calendar-meta.json >/dev/null
echo "RELEASE_PREFLIGHT_OK"
