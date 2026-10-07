#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OWNER="${GMB_GITHUB_OWNER:-aw960809-ai}"
REPO="${GMB_GITHUB_REPO:-goal-manager-basketball-law}"
FULL="$OWNER/$REPO"
EXPECTED_VERSION="0.6.1"
EXPECTED_URL="https://${OWNER}.github.io/${REPO}/"

say(){ printf '\n=== %s ===\n' "$*"; }
fail(){ printf '\n[ERROR] %s\n' "$*" >&2; exit 1; }

cd "$ROOT"

say "Basketball Goal Manager production preflight"
grep -q "version:'${EXPECTED_VERSION}'" config/app-config.js || fail "Expected v${EXPECTED_VERSION} source tree."
grep -q '"productId": "gmb-law"' release.json || fail "Wrong product source tree."
bash scripts/release-preflight.sh

if ! command -v git >/dev/null 2>&1 || ! command -v gh >/dev/null 2>&1; then
  say "Installing Git and GitHub CLI in Termux"
  pkg install -y git gh
fi
if ! command -v curl >/dev/null 2>&1; then
  pkg install -y curl
fi

if ! gh auth status --hostname github.com >/dev/null 2>&1; then
  say "GitHub sign-in required"
  echo "A GitHub browser sign-in will open. Use the account that owns this new site."
  gh auth login --hostname github.com --git-protocol https --web
fi
LOGIN="$(gh api user --jq .login)"
[ "$LOGIN" = "$OWNER" ] || fail "Authenticated GitHub user is '$LOGIN', expected '$OWNER'. Set GMB_GITHUB_OWNER if intentional."

say "Preparing isolated Git repository"
if [ ! -d .git ]; then
  git init -b main
fi
git branch -M main
git config user.name "$OWNER"
git config user.email "252476610+${OWNER}@users.noreply.github.com"

# Do not ever inherit a remote from the original Goal Manager.
if git remote get-url origin >/dev/null 2>&1; then
  CURRENT_ORIGIN="$(git remote get-url origin)"
  case "$CURRENT_ORIGIN" in
    *"github.com/${FULL}"*|*"github.com:${FULL}"*) ;;
    *)
      echo "Removing unrelated origin: $CURRENT_ORIGIN"
      git remote remove origin
      ;;
  esac
fi

git add -A
if ! git diff --cached --quiet; then
  git commit -m "feat: Basketball Goal Manager v${EXPECTED_VERSION} initial production release"
elif ! git rev-parse --verify HEAD >/dev/null 2>&1; then
  fail "No files available for initial commit."
fi

if gh repo view "$FULL" >/dev/null 2>&1; then
  say "Dedicated GitHub repository already exists"
  PERM="$(gh api "repos/$FULL" --jq '.permissions.admin // false')"
  [ "$PERM" = "true" ] || fail "Repository exists but current account is not admin."
  if ! git remote get-url origin >/dev/null 2>&1; then
    git remote add origin "https://github.com/${FULL}.git"
  fi
else
  say "Creating dedicated public GitHub repository"
  gh repo create "$FULL" \
    --public \
    --description "Independent Basketball Goal Manager for THU Law — isolated PWA, Activity Radar and Scholarship Board" \
    --source=. \
    --remote=origin
fi

say "Pushing main branch"
git push -u origin main
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
  [ -n "$run_id" ] || fail "Could not find dispatched run for $label."
  echo "$label run: $run_id"
  gh run watch "$run_id" --repo "$FULL" --exit-status
}

say "Deploying initial GitHub Pages site"
gh workflow run pages.yml --repo "$FULL" --ref main
wait_dispatch pages.yml "Pages"

say "Running first public-data AutoFetch"
gh workflow run autofetch.yml --repo "$FULL" --ref main
if ! wait_dispatch autofetch.yml "AutoFetch"; then
  echo
  echo "AutoFetch failed. The site is still deployed, but public data may remain stale."
  echo "Inspect with: gh run list --repo $FULL --workflow autofetch.yml --limit 3"
  exit 6
fi

# AutoFetch commits made by GITHUB_TOKEN do not reliably emit a normal push-triggered
# workflow. pages.yml also listens to workflow_run for future scheduled refreshes.
# Dispatch once here so first production acceptance always deploys latest main.
say "Deploying refreshed catalogs"
gh workflow run pages.yml --repo "$FULL" --ref main
wait_dispatch pages.yml "Final Pages"

say "Production verification"
PAGE_URL="$(gh api "repos/$FULL/pages" --jq '.html_url // empty' 2>/dev/null || true)"
[ -n "$PAGE_URL" ] || PAGE_URL="$EXPECTED_URL"
printf 'Repository: https://github.com/%s\n' "$FULL"
printf 'Site: %s\n' "$PAGE_URL"

OK=0
for _ in $(seq 1 18); do
  if BODY="$(curl -fsSL "${PAGE_URL%/}/release.json?check=$(date +%s)" 2>/dev/null)"; then
    if printf '%s' "$BODY" | grep -q '"version": "0.6.1"'; then
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
echo "AutoFetch: first run completed"
echo "Scheduled AutoFetch: daily twice"
echo "Pages redeploy: automatic after successful AutoFetch via workflow_run"
echo
echo "Next: open the Website URL on Android, install the PWA, then perform final acceptance."
