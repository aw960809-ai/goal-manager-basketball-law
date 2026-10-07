# Build Status — 0.7.0

## Automation & Review

- ✅ Activity AutoFetch — twice daily
- ✅ Scholarship AutoFetch + official eligibility enrichment — twice daily
- ✅ THU official school-calendar AutoFetch — once daily, latest academic-year announcement/PDF discovery
- ✅ Calendar destructive-change guard + last-good retention
- ✅ GitHub Issue proactive alerts when public-data or calendar AutoFetch fails; recovery closes the alert
- ✅ Review Center — human review for Activity / Scholarship items that are already in the automatic review bucket
- ✅ Hard scholarship exclusions cannot be manually promoted
- ✅ Review decisions persist in isolated user storage and can be exported/imported as JSON
- ✅ System Health shows Activity, Scholarship, THU Calendar freshness and PWA/release coherence
- ✅ AutoFetch-triggered Pages redeploy includes public-data and calendar workflows

## Safety boundaries

- Review Center never edits the public catalog.
- Manual decisions apply only to automatic `review` items on this PWA profile.
- Scholarship REGION / ECONOMIC / IDENTITY / MAJOR / other hard exclusions remain canonical and cannot be overridden by Review Center.
- Public-data workflows never read or modify localStorage, IndexedDB, goals, Timer or Study Logs.
