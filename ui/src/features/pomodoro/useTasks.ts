"use client";

import { useCallback, useEffect, useState } from "react";
import {
	ACTIVE_TASK_STORAGE_KEY,
	MAX_ESTIMATE,
	MIN_ESTIMATE,
	TASKS_STORAGE_KEY,
} from "@/features/pomodoro/constants";
import type { Task, TaskDraft } from "@/features/pomodoro/types";
import { newId } from "@/utils/id";

const clampEstimate = (value: number) =>
	Math.min(MAX_ESTIMATE, Math.max(MIN_ESTIMATE, Math.round(value)));

function loadTasks(): Task[] {
	try {
		const raw = localStorage.getItem(TASKS_STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as Task[];
		if (!Array.isArray(parsed)) return [];
		return parsed;
	} catch {
		return [];
	}
}

function loadActiveTaskId(): string | undefined {
	try {
		return localStorage.getItem(ACTIVE_TASK_STORAGE_KEY) ?? undefined;
	} catch {
		return undefined;
	}
}

export interface UseTasksReturn {
	tasks: Task[];
	/** id of the task the timer is bound to (user-selected, persisted). */
	activeTaskId?: string;
	/** explicitly set (or clear, with undefined) the active task. */
	setActiveTaskId: (id: string | undefined) => void;
	/** select the task as active, or clear it if it is already active. */
	toggleActiveTask: (id: string) => void;
	addTask: (draft: TaskDraft) => Task;
	updateTask: (id: string, draft: TaskDraft) => void;
	deleteTask: (id: string) => Task | undefined;
	restoreTask: (task: Task, index: number) => void;
	toggleDone: (id: string) => void;
	clearCompletedPomodoros: (id: string) => void;
	incrementCompleted: (id: string) => void;
}

// localStorage-backed task list. All task state is client-only — see types.ts.
export function useTasks(): UseTasksReturn {
	const [tasks, setTasks] = useState<Task[]>(() => loadTasks());
	// The active task drives the timer context + pomodoro counting. It is an
	// explicit, user-clicked selection (not derived) and is persisted separately
	// so it survives reload.
	const [activeTaskId, setActiveTaskIdState] = useState<string | undefined>(() => {
		const stored = loadActiveTaskId();
		// Drop a stale id whose task no longer exists / is already done.
		const initial = loadTasks();
		const match = stored ? initial.find((task) => task.id === stored) : undefined;
		return match && !match.done ? stored : undefined;
	});

	useEffect(() => {
		try {
			localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
		} catch {
			// storage may be unavailable (private mode / quota) — degrade silently.
		}
	}, [tasks]);

	useEffect(() => {
		try {
			if (activeTaskId) localStorage.setItem(ACTIVE_TASK_STORAGE_KEY, activeTaskId);
			else localStorage.removeItem(ACTIVE_TASK_STORAGE_KEY);
		} catch {
			// storage may be unavailable (private mode / quota) — degrade silently.
		}
	}, [activeTaskId]);

	const setActiveTaskId = useCallback((id: string | undefined) => {
		setActiveTaskIdState(id);
	}, []);

	const toggleActiveTask = useCallback((id: string) => {
		setActiveTaskIdState((prev) => (prev === id ? undefined : id));
	}, []);

	// Clear the active selection if it points at the given id (used when the
	// active task is deleted or completed so the timer context stays consistent).
	const clearActiveIf = useCallback((id: string) => {
		setActiveTaskIdState((prev) => (prev === id ? undefined : prev));
	}, []);

	const addTask = useCallback((draft: TaskDraft): Task => {
		const task: Task = {
			id: newId(),
			name: draft.name.trim(),
			note: draft.note?.trim() || undefined,
			estimate: clampEstimate(draft.estimate),
			completed: 0,
			done: false,
			createdAt: Date.now(),
		};
		setTasks((prev) => [task, ...prev]);
		return task;
	}, []);

	const updateTask = useCallback((id: string, draft: TaskDraft) => {
		setTasks((prev) =>
			prev.map((task) =>
				task.id === id
					? {
							...task,
							name: draft.name.trim(),
							note: draft.note?.trim() || undefined,
							estimate: clampEstimate(draft.estimate),
						}
					: task
			)
		);
	}, []);

	const deleteTask = useCallback(
		(id: string): Task | undefined => {
			let removed: Task | undefined;
			setTasks((prev) => {
				removed = prev.find((task) => task.id === id);
				return prev.filter((task) => task.id !== id);
			});
			// A deleted task can no longer drive the timer.
			clearActiveIf(id);
			return removed;
		},
		[clearActiveIf]
	);

	// Re-insert a previously deleted task at its original position (undo support).
	const restoreTask = useCallback((task: Task, index: number) => {
		setTasks((prev) => {
			if (prev.some((existing) => existing.id === task.id)) return prev;
			const next = [...prev];
			next.splice(Math.min(index, next.length), 0, task);
			return next;
		});
	}, []);

	const toggleDone = useCallback(
		(id: string) => {
			let becameDone = false;
			setTasks((prev) =>
				prev.map((task) => {
					if (task.id !== id) return task;
					becameDone = !task.done;
					return { ...task, done: !task.done };
				})
			);
			// A completed task shouldn't keep driving the timer; clear it if active.
			if (becameDone) clearActiveIf(id);
		},
		[clearActiveIf]
	);

	// "Clear active pomodoros": reset completed count to 0, keep the estimate.
	const clearCompletedPomodoros = useCallback((id: string) => {
		setTasks((prev) =>
			prev.map((task) => (task.id === id ? { ...task, completed: 0 } : task))
		);
	}, []);

	const incrementCompleted = useCallback((id: string) => {
		setTasks((prev) =>
			prev.map((task) =>
				task.id === id ? { ...task, completed: task.completed + 1 } : task
			)
		);
	}, []);

	return {
		tasks,
		activeTaskId,
		setActiveTaskId,
		toggleActiveTask,
		addTask,
		updateTask,
		deleteTask,
		restoreTask,
		toggleDone,
		clearCompletedPomodoros,
		incrementCompleted,
	};
}
