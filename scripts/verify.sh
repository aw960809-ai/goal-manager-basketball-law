#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)";cd "$ROOT"
echo "== Basketball Goal Manager verify ==";echo "Root: $ROOT";command -v node >/dev/null || { echo "node is required" >&2; exit 1; }
count=0;while IFS= read -r -d '' f; do node --check "$f" >/dev/null;count=$((count+1));done < <(find js config scripts -type f -name '*.js' -print0);echo "JS syntax: $count files OK"
for t in tests/*.test.js; do node "$t"; done
grep -q '"id": "/goal-manager-basketball-law/"' manifest.webmanifest
grep -q "CACHE_PREFIX='gmb-law:pwa:'" sw.js
grep -q "version:'0.7.0'" config/app-config.js
grep -q '"version": "0.7.0"' release.json
grep -q "timerKey:'gmb-law:v1:timer'" config/app-config.js
grep -q "./js/domain/study-logs.js" sw.js
grep -q "./js/domain/opportunities.js" sw.js
grep -q "./js/domain/scholarships.js" sw.js
grep -q "./js/domain/review.js" sw.js
grep -q "./js/system-health.js" sw.js
grep -q "./release.json" sw.js
grep -q "updateViaCache:'none'" js/pwa.js
grep -q "app-config.js?v=0.7.0" index.html
grep -q "system-health.js?v=0.7.0" index.html
grep -q "event.request.mode==='navigate'" sw.js
grep -q "./data/activities.json" sw.js
grep -q "./data/scholarships.json" sw.js
grep -q "./data/school-calendar-meta.json" sw.js
grep -q 'data-page="opportunities"' index.html
grep -q 'data-page="scholarships"' index.html
grep -q 'data-page="review"' index.html
grep -q 'data-page="system"' index.html
grep -q "scholarships.js?v=0.7.0" index.html
grep -q "name: Basketball Goal Manager Public Data AutoFetch" .github/workflows/autofetch.yml
grep -q "release-preflight.sh" .github/workflows/pages.yml
python -m py_compile tools/autofetch/autofetch.py tools/autofetch/scholarship_autofetch.py tools/autofetch/lifecycle_archive.py tools/autofetch/calendar_autofetch.py
python tools/autofetch/calendar_autofetch.py --self-test
python -m json.tool tools/autofetch/sources.json >/dev/null
python -m json.tool tools/autofetch/scholarship-sources.json >/dev/null
python -m json.tool data/activity-archive.json >/dev/null
python -m json.tool data/scholarship-archive.json >/dev/null
python -m json.tool data/school-calendar-meta.json >/dev/null
grep -q "name: Basketball Goal Manager THU Calendar AutoFetch" .github/workflows/calendar-autofetch.yml
grep -q "GitHub Issue 主動告警" js/app.js
node scripts/check-public-data.js
echo "Checking for forbidden legacy runtime namespaces...";if grep -RInE 'thu-goal-personal-v|law-goal-web-v|goalManagerThuCleanPersistentV1' js config index.html sw.js manifest.webmanifest; then echo "Forbidden legacy namespace found" >&2;exit 1;fi
echo "Checking canonical runtime for Level 4 creation...";if grep -RInE --exclude-dir=.git --exclude-dir=data --exclude='README.md' --exclude='*.test.js' --exclude='opportunities.js' 'level\s*[:=]+\s*4|level\)\s*===?\s*4' js config index.html; then echo "Active Level 4 logic found" >&2;exit 1;fi
echo "VERIFY OK"
