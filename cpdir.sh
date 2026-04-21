#!/data/data/com.termux/files/usr/bin/bash

# ============================================
# Copy Current Folder → Termux Home (~)
# Preserves the folder itself
# ============================================

set -e

# Current directory (full path)
SRC_DIR="$(pwd)"

# Extract folder name only
FOLDER_NAME="$(basename "$SRC_DIR")"

# Destination path
DEST_DIR="$HOME/$FOLDER_NAME"

echo "Copying folder:"
echo "$SRC_DIR → $DEST_DIR"

# Copy entire directory
cp -r "$SRC_DIR" "$DEST_DIR"

echo "✅ Folder copy complete."