#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OWNER="${GMB_GITHUB_OWNER:-aw960809-ai}"
REPO="${GMB_GITHUB_REPO:-goal-manager-basketball-law}"
FULL="$OWNER/$REPO"
EXPECTED_VERSION="0.9.0"
EXPECTED_URL="https://${OWNER}.github.io/${REPO}/"
DEPLOY_DIR=""

say(){ printf '\n=== %s ===\n' "$*"; }
fail(){ printf '\n[ERROR] %s\n' "$*" >&2; exit 1; }
cleanup(){ [ -n "${DEPLOY_DIR:-}" ] && [ -d "$DEPLOY_DIR" ] && rm -rf "$DEPLOY_DIR" || true; }
trap cleanup EXIT

cd "$ROOT"

say "Basketball Goal Manager production preflight"
grep -q "version:'${EXPECTED_VERSION}'" config/app-config.js || fail "Expected v${EXPECTED_VERSION} source tree."
grep -q '"productId": "gmb-law"' release.json || fail "Wrong product source tree."
bash scripts/release-preflight.sh

NEEDED=""
for c in git gh curl rsync; do command -v "$c" >/dev/null 2>&1 || NEEDED="$NEEDED $c"; done
if [ -n "$NEEDED" ]; then
  say "Installing deployment tools in Termux"
  pkg install -y git gh curl rsync
fi

if ! gh auth status --hostname github.com >/dev/null 2>&1; then
  say "GitHub sign-in required"
  echo "A GitHub browser sign-in will open. Use the account that owns this site."
  gh auth login --hostname github.com --git-protocol https --web
fi
LOGIN="$(gh api user --jq .login)"
[ "$LOGIN" = "$OWNER" ] || fail "Authenticated GitHub user is '$LOGIN', expected '$OWNER'. Set GMB_GITHUB_OWNER if intentional."

if gh repo view "$FULL" >/dev/null 2>&1; then
  say "Preparing safe update from current production main"
  PERM="$(gh api "repos/$FULL" --jq '.permissions.admin // false')"
  [ "$PERM" = "true" ] || fail "Repository exists but current account is not admin."

  DEPLOY_DIR="$(mktemp -d "${TMPDIR:-$HOME}/gmb-law-deploy.XXXXXX")"
  git clone --depth=1 "https://github.com/${FULL}.git" "$DEPLOY_DIR"

  # Code is mirrored from the release package, but server-managed catalogs are
  # explicitly preserved from current production so a release can never roll
  # AutoFetch data backward.
  rsync -a --delete \
    --exclude '.git/' \
    --exclude 'data/activities.json' \
    --exclude 'data/activity-archive.json' \
    --exclude 'data/scholarships.json' \
    --exclude 'data/scholarship-archive.json' \
    --exclude 'data/school-calendar.json' \
    "$ROOT/" "$DEPLOY_DIR/"

  cd "$DEPLOY_DIR"
  git config user.name "$OWNER"
  git config user.email "252476610+${OWNER}@users.noreply.github.com"
  git add -A
  if ! git diff --cached --quiet; then
    git commit -m "feat: Basketball Goal Manager v${EXPECTED_VERSION} settings appearance and calendar UX"
    git push origin main
  else
    echo "Production main already matches v${EXPECTED_VERSION} code."
  fi
else
  say "Creating dedicated public GitHub repository"
  DEPLOY_DIR="$(mktemp -d "${TMPDIR:-$HOME}/gmb-law-deploy.XXXXXX")"
  rsync -a --delete --exclude '.git/' "$ROOT/" "$DEPLOY_DIR/"
  cd "$DEPLOY_DIR"
  git init -b main
  git config user.name "$OWNER"
  git config user.email "252476610+${OWNER}@users.noreply.github.com"
  git add -A
  git commit -m "feat: Basketball Goal Manager v${EXPECTED_VERSION} initial production release"
  gh repo create "$FULL" \
    --public \
    --description "Independent Basketball Goal Manager for THU Law — isolated PWA, Activity Radar and Scholarship Board" \
    --source=. \
    --remote=origin
  git push -u origin main
fi

sleep 3

say "Enabling GitHub Pages with GitHub Actions"
for attempt in 1 2 3 4 5; do
  if gh api "repos/$FULL/pages" >/dev/null 2>&1; then
    gh api --method PUT "repos/$FULL/pages" -f build_type=workflow >/dev/null
    break
  fi
  if gh api --method POST "repos/$FULL/pages" -f build_type=workflow >/dev/null 2>&1; then
    break
  fi
  [ "$attempt" -lt 5 ] || fail "Could not enable GitHub Pages."
  sleep 4
done

wait_dispatch(){
  local workflow="$1" label="$2" run_id=""
  for _ in $(seq 1 12); do
    run_id="$(gh run list --repo "$FULL" --workflow "$workflow" --event workflow_dispatch --limit 1 --json databaseId --jq '.[0].databaseId // empty' 2>/dev/null || true)"
    [ -n "$run_id" ] && break
    sleep 3
  done
  [ -n "$run_id" ] || return 1
  echo "$label run: $run_id"
  gh run watch "$run_id" --repo "$FULL" --exit-status
}

say "Deploying v${EXPECTED_VERSION} GitHub Pages site"
gh workflow run pages.yml --repo "$FULL" --ref main
wait_dispatch pages.yml "Pages" || fail "Initial Pages deployment failed."

say "Running public-data AutoFetch"
gh workflow run autofetch.yml --repo "$FULL" --ref main
PUBLIC_OK=1
if ! wait_dispatch autofetch.yml "AutoFetch"; then
  PUBLIC_OK=0
  echo "WARNING: public-data AutoFetch failed. Existing catalogs remain in production and an alert issue should be open."
fi

say "Running THU calendar AutoFetch"
gh workflow run calendar-autofetch.yml --repo "$FULL" --ref main
CALENDAR_OK=1
if ! wait_dispatch calendar-autofetch.yml "Calendar AutoFetch"; then
  CALENDAR_OK=0
  echo "WARNING: THU calendar AutoFetch failed. Existing calendar remains in production and an alert issue should be open."
fi

# GITHUB_TOKEN commits do not reliably emit a normal push event. Always dispatch
# one final Pages build so whatever succeeded above becomes visible immediately.
say "Deploying refreshed automation outputs"
gh workflow run pages.yml --repo "$FULL" --ref main
wait_dispatch pages.yml "Final Pages" || fail "Final Pages deployment failed."

say "Production verification"
PAGE_URL="$(gh api "repos/$FULL/pages" --jq '.html_url // empty' 2>/dev/null || true)"
[ -n "$PAGE_URL" ] || PAGE_URL="$EXPECTED_URL"
printf 'Repository: https://github.com/%s\n' "$FULL"
printf 'Site: %s\n' "$PAGE_URL"

OK=0
for _ in $(seq 1 18); do
  if BODY="$(curl -fsSL "${PAGE_URL%/}/release.json?check=$(date +%s)" 2>/dev/null)"; then
    if printf '%s' "$BODY" | grep -q '"version": "0.9.0"'; then
      OK=1; break
    fi
  fi
  sleep 5
done
[ "$OK" -eq 1 ] || fail "Pages is enabled but v${EXPECTED_VERSION} release.json was not observed yet. Recheck the Pages workflow."

echo
echo "=== PRODUCTION READY ==="
echo "Repository: https://github.com/$FULL"
echo "Website: ${PAGE_URL}"
echo "Version: v${EXPECTED_VERSION}"
echo "Public AutoFetch: $([ "$PUBLIC_OK" -eq 1 ] && echo completed || echo 'failed — retained old catalog + alert issue')"
echo "THU Calendar AutoFetch: $([ "$CALENDAR_OK" -eq 1 ] && echo completed || echo 'failed — retained old calendar + alert issue')"
echo "Scheduled AutoFetch: public data daily twice; THU calendar daily once"
echo "Review Center: compact review rows + local approve / exclude / pending decisions enabled"
echo "Failure alerts: GitHub Issues are opened automatically and closed on recovery"
echo "Pages redeploy: automatic after successful AutoFetch via workflow_run"
echo
echo "Next: open the Website URL on Android and verify SYSTEM HEALTH + REVIEW CENTER."
