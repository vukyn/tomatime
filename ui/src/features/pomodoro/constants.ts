import type { IntervalKind } from "@/features/pomodoro/types";

// Default minutes per interval (mock: Pomodoro 25 · Short 5 · Long 15).
export const INTERVAL_MINUTES: Record<IntervalKind, number> = {
	pomodoro: 25,
	shortBreak: 5,
	longBreak: 15,
};

export const INTERVAL_LABEL: Record<IntervalKind, string> = {
	pomodoro: "Pomodoro",
	shortBreak: "Short Break",
	longBreak: "Long Break",
};

// Clock face label under the countdown (uppercase in the mock).
export const INTERVAL_CLOCK_LABEL: Record<IntervalKind, string> = {
	pomodoro: "Focus",
	shortBreak: "Break",
	longBreak: "Break",
};

export const INTERVAL_ORDER: IntervalKind[] = [
	"pomodoro",
	"shortBreak",
	"longBreak",
];

// Minutes clamp for the idle +/- steppers.
export const MIN_MINUTES = 1;
export const MAX_MINUTES = 60;

// Estimate clamp for the task create/edit stepper.
export const MIN_ESTIMATE = 1;
export const MAX_ESTIMATE = 99;

// After every Nth completed focus pomodoro, take a long break.
export const POMODOROS_PER_LONG_BREAK = 4;

export const TASKS_STORAGE_KEY = "tomatime.tasks.v1";

// Persisted id of the user-selected active task (timer binding).
export const ACTIVE_TASK_STORAGE_KEY = "tomatime.activeTask.v1";

// Persisted flag: the notification nudge banner has been dismissed by the user.
export const NOTIF_DISMISSED_STORAGE_KEY = "tomatime.notif.dismissed";
