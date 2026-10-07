# Production Deployment — GitHub Pages

The production target is a **separate repository and URL** from the original Goal Manager.

Recommended repository name:

```text
goal-manager-basketball-law
```

The PWA manifest ID is already isolated as:

```text
/goal-manager-basketball-law/
```

## Before first push

Run:

```bash
bash scripts/release-preflight.sh
```

## GitHub Pages

After pushing to `main`:

1. Open repository **Settings → Pages**.
2. Under **Build and deployment**, select **GitHub Actions**.
3. Run or wait for `Deploy Basketball Goal Manager to Pages`.
4. Run `Basketball Goal Manager Public Data AutoFetch` once manually.
5. Open the deployed site → `SYSTEM HEALTH` and confirm:
   - Activity is not stale.
   - Scholarship is not stale.
   - Page / Service Worker / published release versions are equal.

## AutoFetch ownership

The scheduled updater modifies only:

- `data/activities.json`
- `data/scholarships.json`
- `data/activity-archive.json`
- `data/scholarship-archive.json`

It does not and cannot access browser localStorage / IndexedDB.

## Production acceptance

On Android, verify:

- installable as a separate PWA from the original Goal Manager;
- goals and Study Logs remain after full close/reopen;
- public data refreshes after an AutoFetch commit;
- existing goals are not cleared by a new release;
- offline reopen uses the last good cache;
- after returning online, `SYSTEM HEALTH` reports current release coherence.

## One-command Termux production deployment (v0.9.0+)

The installed project now contains a guarded deployment helper:

```bash
cd ~/goal-manager-basketball-law
bash scripts/production-deploy.sh
```

It will:

- verify the release before any GitHub mutation;
- use GitHub CLI browser authentication if needed;
- create `aw960809-ai/goal-manager-basketball-law` only if it does not exist;
- push only this isolated project;
- enable Pages in GitHub Actions mode;
- deploy Pages;
- run the first Activity + Scholarship AutoFetch;
- deploy the refreshed catalogs again;
- verify the published `release.json` is the expected version.

`pages.yml` also listens for a successful AutoFetch `workflow_run`, so future scheduled catalog refreshes redeploy the latest `main` even though AutoFetch commits are created by `GITHUB_TOKEN`.


## v0.9.0 automation

- `.github/workflows/autofetch.yml`: Activity + Scholarship, twice daily.
- `.github/workflows/calendar-autofetch.yml`: THU official calendar, once daily.
- Both workflows create a GitHub Issue on failure and close it after recovery.
- Successful updater runs cause Pages to redeploy through `workflow_run`.
