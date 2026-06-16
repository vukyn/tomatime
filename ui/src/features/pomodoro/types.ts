// Pomodoro feature domain types. This feature is client-state only (persisted to
// localStorage) — there is no backend `task` domain yet. If server persistence
// is ever required, these shapes map cleanly onto a future tomatime task DTO.

export type IntervalKind = "pomodoro" | "shortBreak" | "longBreak";

export interface Task {
	id: string;
	name: string;
	note?: string;
	/** estimated pomodoros to finish this task (clamped 1..99) */
	estimate: number;
	/** completed pomodoros logged against this task */
	completed: number;
	done: boolean;
	createdAt: number;
}

export interface TaskDraft {
	name: string;
	note?: string;
	estimate: number;
}
