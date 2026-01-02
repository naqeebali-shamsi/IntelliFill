#!/bin/bash
# Instant Rollback to Task Checkpoint
# Reverts git to any checkpoint tag with safety backup

set -e

TASK_ID=$1

if [ -z "$TASK_ID" ]; then
    echo "Usage: bash .taskmaster/scripts/rollback.sh <task_id>"
    echo "Example: bash .taskmaster/scripts/rollback.sh 3"
    exit 1
fi

CHECKPOINT_TAG="checkpoint-task-$TASK_ID"
BACKUP_BRANCH="rollback-backup-$(date +%Y%m%d-%H%M%S)"
PROGRESS_FILE=".taskmaster/docs/progress.md"

# Check if checkpoint tag exists
if ! git tag | grep -q "^$CHECKPOINT_TAG$"; then
    echo "❌ Error: Checkpoint tag '$CHECKPOINT_TAG' not found"
    echo ""
    echo "Available checkpoints:"
    git tag | grep "^checkpoint-task-" || echo "  (none)"
    exit 1
fi

# Show what will happen
echo "🔄 Rollback to Task $TASK_ID"
echo ""
echo "⚠️  This will:"
echo "  - Discard all changes after Task $TASK_ID"
echo "  - Reset to $CHECKPOINT_TAG"
echo "  - Preserve current work in branch: $BACKUP_BRANCH"
echo ""

# Get current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Safety confirmation
read -p "Type 'yes' to confirm: " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "💾 Creating backup..."

# Create backup branch from current state
git branch "$BACKUP_BRANCH" || {
    echo "❌ Failed to create backup branch"
    exit 1
}

echo "✅ Backed up to: $BACKUP_BRANCH"
echo ""

# Reset to checkpoint
echo "🔄 Rolling back..."
git reset --hard "$CHECKPOINT_TAG" || {
    echo "❌ Rollback failed"
    exit 1
}

echo "✅ Rolled back to Task $TASK_ID"
echo ""

# Update progress.md
if [ -f "$PROGRESS_FILE" ]; then
    echo "" >> "$PROGRESS_FILE"
    echo "## ROLLBACK - $(date -u +"%Y-%m-%d %H:%M:%S UTC")" >> "$PROGRESS_FILE"
    echo "**Action**: Rolled back to Task $TASK_ID (checkpoint: $CHECKPOINT_TAG)" >> "$PROGRESS_FILE"
    echo "**Backup**: Changes preserved in branch: $BACKUP_BRANCH" >> "$PROGRESS_FILE"
    echo "**Previous branch**: $CURRENT_BRANCH" >> "$PROGRESS_FILE"
    echo "" >> "$PROGRESS_FILE"

    echo "📝 Updated progress.md"
fi

echo ""
echo "📍 Current state: Task $TASK_ID checkpoint"
echo "🔖 Backup branch: $BACKUP_BRANCH"
echo ""
echo "What next?"
echo "  1. Resume from here (continue with Task $((TASK_ID + 1)))"
echo "  2. Redo Task $TASK_ID"
echo "  3. View backup: git checkout $BACKUP_BRANCH"
echo "  4. Manual control"
