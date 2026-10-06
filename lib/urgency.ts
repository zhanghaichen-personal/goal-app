import type { Task } from "./types";

export function isUrgent(task: Task, now = new Date()) {
  if (task.urgency_override === "urgent") return true;
  if (task.urgency_override === "later") return false;
  if (task.is_long_term || !task.deadline) return false;

  const deadline = new Date(task.deadline).getTime();
  const threshold = task.urgent_before_days * 24 * 60 * 60 * 1000;
  return now.getTime() >= deadline - threshold;
}

export function quadrant(task: Task) {
  const urgent = isUrgent(task);
  if (task.is_important && urgent) return "important-now";
  if (task.is_important && !urgent) return "important-later";
  if (!task.is_important && urgent) return "other-now";
  return "other-later";
}
