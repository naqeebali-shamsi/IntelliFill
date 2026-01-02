#!/usr/bin/env python3
"""
Real DateTime Tracking for TaskMaster
Tracks start/end times with UTC timestamps and calculates precise durations.
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

STATE_FILE = Path(".taskmaster/state/time-tracking.json")


def load_state() -> dict:
    """Load tracking state from JSON file."""
    if STATE_FILE.exists():
        with open(STATE_FILE, 'r') as f:
            return json.load(f)
    return {"tasks": {}}


def save_state(state: dict) -> None:
    """Save tracking state to JSON file."""
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(STATE_FILE, 'w') as f:
        json.dump(state, f, indent=2)


def format_duration(minutes: float) -> str:
    """Format duration in human-readable format."""
    if minutes < 60:
        return f"{int(minutes)} min"
    hours = minutes / 60
    return f"{hours:.1f}h ({int(minutes)} min)"


def start_tracking(task_id: str, subtask_id: Optional[str] = None) -> None:
    """Start tracking time for a task or subtask."""
    state = load_state()
    now = datetime.now(timezone.utc).isoformat()

    key = f"{task_id}.{subtask_id}" if subtask_id else task_id

    if key not in state["tasks"]:
        state["tasks"][key] = {}

    state["tasks"][key]["start"] = now
    state["tasks"][key]["status"] = "in_progress"

    save_state(state)

    print(f"📅 Started: {now}")
    print(f"⏱️  Tracking: {'Subtask ' + subtask_id if subtask_id else 'Task ' + task_id}")


def complete_tracking(task_id: str, subtask_id: Optional[str] = None, estimated_minutes: Optional[int] = None) -> None:
    """Complete tracking and calculate duration."""
    state = load_state()
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    key = f"{task_id}.{subtask_id}" if subtask_id else task_id

    if key not in state["tasks"] or "start" not in state["tasks"][key]:
        print(f"❌ Error: No start time found for {key}")
        print(f"   Run: python3 .taskmaster/scripts/track-time.py start {task_id}{' ' + subtask_id if subtask_id else ''}")
        sys.exit(1)

    start = datetime.fromisoformat(state["tasks"][key]["start"])
    duration = (now - start).total_seconds() / 60  # minutes

    state["tasks"][key]["end"] = now_iso
    state["tasks"][key]["duration_minutes"] = round(duration, 1)
    state["tasks"][key]["status"] = "completed"

    if estimated_minutes:
        state["tasks"][key]["estimated_minutes"] = estimated_minutes
        accuracy = (duration / estimated_minutes) * 100
        state["tasks"][key]["accuracy_percent"] = round(accuracy, 1)

    save_state(state)

    print(f"✅ COMPLETED")
    print(f"📅 Ended: {now_iso}")
    print(f"⏱️  Actual: {format_duration(duration)}")

    if estimated_minutes:
        accuracy = (duration / estimated_minutes) * 100
        variance = abs(100 - accuracy)
        status = "✅" if variance <= 20 else "⚠️"
        print(f"📊 vs Estimate: {format_duration(estimated_minutes)} - {status} {variance:.0f}% variance")


def show_summary(task_id: Optional[str] = None) -> None:
    """Show summary of tracked time."""
    state = load_state()

    if not state["tasks"]:
        print("No tracked tasks yet.")
        return

    tasks_to_show = state["tasks"]
    if task_id:
        tasks_to_show = {k: v for k, v in state["tasks"].items() if k.startswith(task_id)}

    print("\n📊 Time Tracking Summary\n")
    total_minutes = 0

    for key, data in sorted(tasks_to_show.items()):
        status_icon = "✅" if data.get("status") == "completed" else "⏱️"
        print(f"{status_icon} {key}")

        if "start" in data:
            print(f"   Started: {data['start']}")

        if data.get("status") == "completed" and "duration_minutes" in data:
            duration = data["duration_minutes"]
            total_minutes += duration
            print(f"   Duration: {format_duration(duration)}")

            if "estimated_minutes" in data:
                est = data["estimated_minutes"]
                acc = data.get("accuracy_percent", 0)
                print(f"   Estimated: {format_duration(est)} ({acc:.0f}% accurate)")

        print()

    if total_minutes > 0:
        print(f"Total Time: {format_duration(total_minutes)}")


def main():
    """Main CLI entry point."""
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python3 track-time.py start <task_id> [subtask_id]")
        print("  python3 track-time.py complete <task_id> [subtask_id] [estimated_minutes]")
        print("  python3 track-time.py summary [task_id]")
        sys.exit(1)

    command = sys.argv[1]

    if command == "start":
        if len(sys.argv) < 3:
            print("Error: task_id required")
            sys.exit(1)
        task_id = sys.argv[2]
        subtask_id = sys.argv[3] if len(sys.argv) > 3 else None
        start_tracking(task_id, subtask_id)

    elif command == "complete":
        if len(sys.argv) < 3:
            print("Error: task_id required")
            sys.exit(1)
        task_id = sys.argv[2]
        subtask_id = sys.argv[3] if len(sys.argv) > 3 and not sys.argv[3].isdigit() else None
        estimated = int(sys.argv[4] if len(sys.argv) > 4 else (sys.argv[3] if len(sys.argv) > 3 and sys.argv[3].isdigit() else 0))
        complete_tracking(task_id, subtask_id, estimated if estimated > 0 else None)

    elif command == "summary":
        task_id = sys.argv[2] if len(sys.argv) > 2 else None
        show_summary(task_id)

    else:
        print(f"Unknown command: {command}")
        sys.exit(1)


if __name__ == "__main__":
    main()
