#!/data/data/com.termux/files/usr/bin/bash

# ============================================
# Smart Git Push Script (Termux Optimized)
# ============================================

set -e

BRANCH="main"

echo "📂 $(pwd)"

# Ensure git exists
if ! command -v git >/dev/null 2>&1; then
  echo "❌ Git not installed"
  exit 1
fi

# Init repo if needed
if [ ! -d ".git" ]; then
  echo "⚙️ Initializing repo..."
  git init -b $BRANCH
fi

# Stage files
git add .

# Commit if needed
if git diff --cached --quiet; then
  echo "⚠️ No changes to commit"
else
  read -p "📝 Commit message (enter = auto): " MSG
  MSG=${MSG:-"update: $(date '+%Y-%m-%d %H:%M:%S')"}
  git commit -m "$MSG"
fi

# Ensure remote exists
if ! git remote get-url origin >/dev/null 2>&1; then
  read -p "🔗 Enter repo URL: " REPO
  [ -z "$REPO" ] && echo "❌ No repo URL" && exit 1
  git remote add origin "$REPO"
fi

# Ensure branch exists
git branch -M $BRANCH

# Push
echo "🚀 Pushing..."
git push -u origin $BRANCH

echo "✅ Done"
