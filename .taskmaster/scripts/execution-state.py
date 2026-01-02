#!/usr/bin/env python3
"""
Execution State Management for Crash Recovery
Tracks execution state to enable resume after crashes.
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

STATE_FILE = Path(".taskmaster/state/execution-state.json")


def load_state() -> dict:
    """Load execution state from JSON file."""
    if STATE_FILE.exists():
        with open(STATE_FILE, 'r') as f:
            return json.load(f)
    return {
        "mode": None,
        "task_id": None,
        "subtask_id": None,
        "last_updated": None,
        "completed_tasks": [],
        "completed_subtasks": [],
        "in_progress": False
    }


def save_state(state: dict) -> None:
    """Save execution state to JSON file."""
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    state["last_updated"] = datetime.now(timezone.utc).isoformat()
    with open(STATE_FILE, 'w') as f:
        json.dump(state, f, indent=2)


def start_execution(mode: str) -> None:
    """Start new execution session."""
    state = load_state()

    # Check if there's incomplete work
    if state.get("in_progress"):
        print("⚠️  WARNING: Previous execution session was not completed properly.")
        print(f"   Last activity: {state.get('last_updated')}")
        print(f"   Mode: {state.get('mode')}")
        print(f"   Task: {state.get('task_id')}")
        print()
        print("Options:")
        print("  1. Resume previous session")
        print("  2. Start fresh (discard previous state)")
        print()
        choice = input("Type 1 or 2: ").strip()

        if choice == "1":
            print("✅ Resuming previous session...")
            return
        else:
            print("✅ Starting fresh...")

    state["mode"] = mode
    state["task_id"] = None
    state["subtask_id"] = None
    state["completed_tasks"] = []
    state["completed_subtasks"] = []
    state["in_progress"] = True

    save_state(state)
    print(f"✅ Execution started: {mode} mode")


def update_task(task_id: str, subtask_id: Optional[str] = None) -> None:
    """Update current task/subtask being worked on."""
    state = load_state()

    state["task_id"] = task_id
    state["subtask_id"] = subtask_id
    state["in_progress"] = True

    save_state(state)


def complete_subtask(task_id: str, subtask_id: str) -> None:
    """Mark a subtask as completed."""
    state = load_state()

    subtask_key = f"{task_id}.{subtask_id}"
    if subtask_key not in state["completed_subtasks"]:
        state["completed_subtasks"].append(subtask_key)

    save_state(state)


def complete_task(task_id: str) -> None:
    """Mark a task as completed."""
    state = load_state()

    if task_id not in state["completed_tasks"]:
        state["completed_tasks"].append(task_id)

    # Clear current task
    if state.get("task_id") == task_id:
        state["task_id"] = None
        state["subtask_id"] = None

    save_state(state)


def check_incomplete() -> dict:
    """Check for incomplete work and return state."""
    state = load_state()

    if not state.get("in_progress"):
        return None

    # Check if last update was recent (< 5 minutes = still running)
    if state.get("last_updated"):
        try:
            last_update = datetime.fromisoformat(state["last_updated"])
            now = datetime.now(timezone.utc)
            minutes_ago = (now - last_update).total_seconds() / 60

            if minutes_ago < 5:
                # Still running, not a crash
                return None
        except Exception:
            pass

    return state


def show_status() -> None:
    """Show current execution status."""
    state = load_state()

    if not state.get("in_progress"):
        print("No active execution session.")
        return

    print("\n📊 Execution State\n")
    print(f"Mode: {state.get('mode', 'Unknown')}")
    print(f"Last Updated: {state.get('last_updated', 'Unknown')}")
    print()

    if state.get("task_id"):
        print(f"Current Task: {state['task_id']}")
        if state.get("subtask_id"):
            print(f"Current Subtask: {state['subtask_id']}")
        print()

    completed = state.get("completed_tasks", [])
    if completed:
        print(f"Completed Tasks: {len(completed)}")
        print(f"  {', '.join(completed[-5:])}")  # Show last 5
    else:
        print("Completed Tasks: 0")

    print()


def end_execution() -> None:
    """Mark execution as complete."""
    state = load_state()
    state["in_progress"] = False
    save_state(state)
    print("✅ Execution marked as complete")


def main():
    """Main CLI entry point."""
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python3 execution-state.py start <mode>")
        print("  python3 execution-state.py update <task_id> [subtask_id]")
        print("  python3 execution-state.py complete-subtask <task_id> <subtask_id>")
        print("  python3 execution-state.py complete-task <task_id>")
        print("  python3 execution-state.py check")
        print("  python3 execution-state.py status")
        print("  python3 execution-state.py end")
        sys.exit(1)

    command = sys.argv[1]

    if command == "start":
        if len(sys.argv) < 3:
            print("Error: mode required (sequential|parallel|full|manual)")
            sys.exit(1)
        mode = sys.argv[2]
        start_execution(mode)

    elif command == "update":
        if len(sys.argv) < 3:
            print("Error: task_id required")
            sys.exit(1)
        task_id = sys.argv[2]
        subtask_id = sys.argv[3] if len(sys.argv) > 3 else None
        update_task(task_id, subtask_id)
        print(f"✅ Updated state: Task {task_id}{' Subtask ' + subtask_id if subtask_id else ''}")

    elif command == "complete-subtask":
        if len(sys.argv) < 4:
            print("Error: task_id and subtask_id required")
            sys.exit(1)
        task_id = sys.argv[2]
        subtask_id = sys.argv[3]
        complete_subtask(task_id, subtask_id)
        print(f"✅ Completed: Task {task_id} Subtask {subtask_id}")

    elif command == "complete-task":
        if len(sys.argv) < 3:
            print("Error: task_id required")
            sys.exit(1)
        task_id = sys.argv[2]
        complete_task(task_id)
        print(f"✅ Completed: Task {task_id}")

    elif command == "check":
        incomplete = check_incomplete()
        if incomplete:
            print("🔍 Detected incomplete work from previous session\n")
            print("📍 Last Activity:")
            print(f"  - Mode: {incomplete.get('mode')}")
            print(f"  - Task: {incomplete.get('task_id')}")
            if incomplete.get('subtask_id'):
                print(f"  - Subtask: {incomplete.get('subtask_id')}")
            print(f"  - Last updated: {incomplete.get('last_updated')}")

            completed = incomplete.get('completed_tasks', [])
            if completed:
                print(f"  - Completed: Tasks {', '.join(completed[-5:])}")

            print()
            print("Resume from:")
            print("  1. Last subtask (continue where crashed)")
            print("  2. Restart current task")
            print("  3. Last checkpoint")
            print("  4. Start fresh")

            sys.exit(1)  # Exit with error code to signal incomplete work
        else:
            print("✅ No incomplete work detected")
            sys.exit(0)

    elif command == "status":
        show_status()

    elif command == "end":
        end_execution()

    else:
        print(f"Unknown command: {command}")
        sys.exit(1)


if __name__ == "__main__":
    main()
