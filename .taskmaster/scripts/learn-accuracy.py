#!/usr/bin/env python3
"""
Estimation Accuracy Learning System
Analyzes estimated vs actual time and recommends adjustments.
"""

import json
import sys
from pathlib import Path
from typing import Dict, List, Tuple

STATE_FILE = Path(".taskmaster/state/time-tracking.json")
ACCURACY_FILE = Path(".taskmaster/state/accuracy-learning.json")


def load_tracking_state() -> dict:
    """Load time tracking state."""
    if STATE_FILE.exists():
        with open(STATE_FILE, 'r') as f:
            return json.load(f)
    return {"tasks": {}}


def load_accuracy_state() -> dict:
    """Load accuracy learning state."""
    if ACCURACY_FILE.exists():
        with open(ACCURACY_FILE, 'r') as f:
            return json.load(f)
    return {"analyses": [], "current_adjustment": 1.0}


def save_accuracy_state(state: dict) -> None:
    """Save accuracy learning state."""
    ACCURACY_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(ACCURACY_FILE, 'w') as f:
        json.dump(state, f, indent=2)


def analyze_accuracy(min_tasks: int = 5) -> Tuple[List[Dict], float, float]:
    """
    Analyze accuracy of completed tasks.
    Returns: (task_list, average_accuracy_percent, adjustment_factor)
    """
    tracking = load_tracking_state()
    completed_tasks = []

    for key, data in tracking["tasks"].items():
        if (data.get("status") == "completed" and
            "duration_minutes" in data and
            "estimated_minutes" in data):

            duration = data["duration_minutes"]
            estimated = data["estimated_minutes"]
            accuracy = (duration / estimated) * 100

            completed_tasks.append({
                "task": key,
                "estimated": estimated,
                "actual": duration,
                "accuracy_percent": round(accuracy, 1),
                "variance_percent": round(abs(100 - accuracy), 1)
            })

    if len(completed_tasks) < min_tasks:
        return completed_tasks, 100.0, 1.0

    # Calculate average accuracy
    total_accuracy = sum(t["accuracy_percent"] for t in completed_tasks)
    avg_accuracy = total_accuracy / len(completed_tasks)

    # Calculate adjustment factor (how much to multiply estimates by)
    total_estimated = sum(t["estimated"] for t in completed_tasks)
    total_actual = sum(t["actual"] for t in completed_tasks)
    adjustment_factor = total_actual / total_estimated if total_estimated > 0 else 1.0

    return completed_tasks, avg_accuracy, adjustment_factor


def show_report(recent: int = 10) -> None:
    """Show accuracy report."""
    tasks, avg_accuracy, adjustment = analyze_accuracy()

    if not tasks:
        print("❌ No completed tasks with estimates found.")
        print("   Track tasks with: python3 .taskmaster/scripts/track-time.py complete <id> <estimated_minutes>")
        return

    print("\n📊 Estimation Accuracy Analysis\n")
    print(f"Tasks Analyzed: {len(tasks)}")
    print(f"Average Accuracy: {avg_accuracy:.0f}%")
    print(f"Adjustment Factor: {adjustment:.2f}x")
    print()

    # Show recent tasks
    recent_tasks = sorted(tasks, key=lambda x: x["task"])[-recent:]
    print(f"Recent Tasks (last {min(len(recent_tasks), recent)}):")
    for task in recent_tasks:
        variance = task["variance_percent"]
        status = "✅" if variance <= 20 else "⚠️"
        print(f"  {task['task']}:  {int(task['actual'])}min (est: {int(task['estimated'])}min) - {task['accuracy_percent']:.0f}% {status}")

    print()

    # Provide recommendations
    if avg_accuracy < 80:
        print("✅ You're faster than estimated!")
        print(f"   Consider reducing future estimates by {100 - avg_accuracy:.0f}%")
    elif avg_accuracy > 120:
        print(f"⚠️  You're taking {avg_accuracy - 100:.0f}% longer than estimated.")
        print()
        print("Recommendations:")
        print(f"  1. Increase all future estimates by {avg_accuracy - 100:.0f}%")
        print(f"  2. Apply {adjustment:.2f}x multiplier to estimates")
        print(f"  3. Review task breakdown (tasks may need more subtasks)")
    else:
        print("✅ Your estimates are accurate!")
        print("   Keep up the good work!")


def apply_adjustment(task_ids: List[str] = None) -> None:
    """Apply adjustment factor to pending tasks."""
    tasks, avg_accuracy, adjustment = analyze_accuracy()

    if not tasks:
        print("❌ No accuracy data available yet.")
        return

    accuracy_state = load_accuracy_state()

    adjustment_record = {
        "timestamp": None,  # Would need datetime import
        "tasks_analyzed": len(tasks),
        "avg_accuracy": round(avg_accuracy, 1),
        "adjustment_factor": round(adjustment, 2),
        "applied_to_tasks": task_ids or ["all_pending"]
    }

    accuracy_state["analyses"].append(adjustment_record)
    accuracy_state["current_adjustment"] = round(adjustment, 2)

    save_accuracy_state(accuracy_state)

    print(f"✅ Adjustment factor saved: {adjustment:.2f}x")
    print(f"   Apply this multiplier to your estimates.")
    print(f"   Example: 30min estimate → {int(30 * adjustment)}min adjusted")


def main():
    """Main CLI entry point."""
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python3 learn-accuracy.py report [num_recent]")
        print("  python3 learn-accuracy.py apply [task_ids...]")
        sys.exit(1)

    command = sys.argv[1]

    if command == "report":
        recent = int(sys.argv[2]) if len(sys.argv) > 2 else 10
        show_report(recent)

    elif command == "apply":
        task_ids = sys.argv[2:] if len(sys.argv) > 2 else None
        apply_adjustment(task_ids)

    else:
        print(f"Unknown command: {command}")
        sys.exit(1)


if __name__ == "__main__":
    main()
