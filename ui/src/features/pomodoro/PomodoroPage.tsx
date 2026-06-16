"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Flex, Heading } from "@chakra-ui/react";
import { LuListChecks } from "react-icons/lu";
import { AddTaskTrigger } from "@/features/pomodoro/components/AddTaskTrigger";
import { BrandHeader } from "@/features/pomodoro/components/BrandHeader";
import { ConfirmDeleteDialog } from "@/features/pomodoro/components/ConfirmDeleteDialog";
import { StatsBar } from "@/features/pomodoro/components/StatsBar";
import { TaskForm } from "@/features/pomodoro/components/TaskForm";
import { TaskList } from "@/features/pomodoro/components/TaskList";
import { TimerPanel } from "@/features/pomodoro/components/TimerPanel";
import { INTERVAL_MINUTES } from "@/features/pomodoro/constants";
import type { Task, TaskDraft } from "@/features/pomodoro/types";
import { useTasks } from "@/features/pomodoro/useTasks";
import { useTimer } from "@/features/pomodoro/useTimer";
import { toaster } from "@/components/ui/toaster";
import { formatClockTime, formatDuration } from "@/utils/time";

// Single-page Pomodoro app. All state is client-side (see types.ts / useTasks).
export function PomodoroPage() {
	const {
		tasks,
		activeTaskId,
		toggleActiveTask,
		addTask,
		updateTask,
		deleteTask,
		restoreTask,
		toggleDone,
		clearCompletedPomodoros,
		incrementCompleted,
	} = useTasks();

	// The active task is an explicit, user-clicked selection (persisted in
	// useTasks) — it links to the running timer.
	const activeTask = useMemo(
		() => tasks.find((task) => task.id === activeTaskId),
		[tasks, activeTaskId]
	);
	const activeTaskIdRef = useRef<string | undefined>(activeTask?.id);
	useEffect(() => {
		activeTaskIdRef.current = activeTask?.id;
	}, [activeTask]);

	// When a focus interval completes, log a pomodoro against the active task.
	const handleFocusComplete = useCallback(() => {
		const id = activeTaskIdRef.current;
		if (id) incrementCompleted(id);
	}, [incrementCompleted]);

	const timer = useTimer({ onFocusComplete: handleFocusComplete });

	const [editing, setEditing] = useState<Task | undefined>();
	const [pendingDelete, setPendingDelete] = useState<Task | undefined>();
	// Create form is collapsed by default — a single AddTaskTrigger stands in for
	// it until expanded. Edit mode always shows the form regardless of this flag.
	const [createExpanded, setCreateExpanded] = useState(false);

	// Spacebar toggles START/STOP when no interactive element is focused. A
	// focused task row handles Space itself (activate) — the `data-task-row`
	// marker makes the global handler skip it so it never double-fires.
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.code !== "Space") return;
			const target = event.target as HTMLElement | null;
			const tag = target?.tagName;
			const isInteractive =
				tag === "INPUT" ||
				tag === "TEXTAREA" ||
				tag === "BUTTON" ||
				target?.isContentEditable ||
				target?.closest?.("[data-task-row]") != null;
			if (isInteractive) return;
			event.preventDefault();
			timer.toggle();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [timer]);

	const handleSubmit = (draft: TaskDraft) => {
		if (editing) {
			updateTask(editing.id, draft);
			setEditing(undefined);
		} else {
			addTask(draft);
		}
	};

	const requestDelete = (task: Task) => setPendingDelete(task);

	const confirmDelete = () => {
		const target = pendingDelete;
		setPendingDelete(undefined);
		if (!target) return;
		const index = tasks.findIndex((task) => task.id === target.id);
		const removed = deleteTask(target.id);
		if (editing?.id === target.id) setEditing(undefined);
		if (!removed) return;
		toaster.create({
			title: "Task deleted",
			description: removed.name,
			type: "info",
			closable: true,
			action: {
				label: "Undo",
				onClick: () => restoreTask(removed, Math.max(0, index)),
			},
		});
	};

	// --- Session stats (pure derivation from tasks) --------------------------
	const stats = useMemo(() => {
		const completed = tasks.reduce((sum, task) => sum + task.completed, 0);
		const totalEstimate = tasks.reduce((sum, task) => sum + task.estimate, 0);
		// Remaining focus pomodoros across not-done tasks.
		const remainingPomodoros = tasks
			.filter((task) => !task.done)
			.reduce((sum, task) => sum + Math.max(0, task.estimate - task.completed), 0);

		// Minutes of work + interleaved breaks still ahead of us.
		const longBreaks = Math.floor(remainingPomodoros / 4);
		const shortBreaks = Math.max(0, remainingPomodoros - 1 - longBreaks);
		const minutesAhead =
			remainingPomodoros * INTERVAL_MINUTES.pomodoro +
			shortBreaks * INTERVAL_MINUTES.shortBreak +
			longBreaks * INTERVAL_MINUTES.longBreak;

		return {
			completed,
			totalEstimate,
			remainingPomodoros,
			minutesAhead,
			// Focus time logged so far (completed pomodoros × focus length).
			focusTime: formatDuration(completed * INTERVAL_MINUTES.pomodoro),
		};
	}, [tasks]);

	// Estimated finish depends on the wall clock ("now"), so it is computed in an
	// effect (impure) rather than during render, and refreshed every minute.
	const [estimatedFinish, setEstimatedFinish] = useState("—");
	useEffect(() => {
		const compute = () =>
			setEstimatedFinish(
				stats.remainingPomodoros > 0
					? formatClockTime(new Date(Date.now() + stats.minutesAhead * 60_000))
					: "—"
			);
		compute();
		const handle = window.setInterval(compute, 60_000);
		return () => window.clearInterval(handle);
	}, [stats.remainingPomodoros, stats.minutesAhead]);

	return (
		<Box maxW="640px" mx="auto" px="16px" pb="48px">
			{/* First viewport: brand header + timer occupy a full screen,
			    vertically centered. min-h="100dvh" (not fixed height) so on short
			    viewports the block can grow past the fold and the page still
			    scrolls instead of clipping. This pushes Tasks below the fold. */}
			<Box
				minH="100dvh"
				display="flex"
				flexDirection="column"
				justifyContent="flex-start"
				gap="48px"
				pt="4vh"
				pb="48px"
			>
				<BrandHeader />

				<TimerPanel timer={timer} activeTask={activeTask} />
			</Box>

			<Box as="section" aria-label="Tasks" display="flex" flexDirection="column" gap="24px" mt="64px">
				<Heading
					as="h2"
					fontFamily="heading"
					fontWeight="900"
					fontSize="1.3rem"
					letterSpacing="-0.02em"
					color="clay.ink900"
					display="flex"
					alignItems="center"
					gap="8px"
				>
					<Flex as="span" color="clay.tomato600" align="center">
						<LuListChecks size={22} />
					</Flex>
					Tasks
				</Heading>

				{/* Editing always shows the form; otherwise the create form is
				    collapsed behind the trigger until expanded. Remount on
				    edit-target / expand change so the form re-seeds its state and
				    autofocuses the name input. */}
				{editing || createExpanded ? (
					<TaskForm
						key={editing?.id ?? "new"}
						editing={editing}
						onSubmit={handleSubmit}
						onCancelEdit={() => setEditing(undefined)}
						onClose={editing ? undefined : () => setCreateExpanded(false)}
					/>
				) : (
					<AddTaskTrigger onClick={() => setCreateExpanded(true)} />
				)}

				<TaskList
					tasks={tasks}
					activeTaskId={activeTask?.id}
					onActivate={toggleActiveTask}
					onToggleDone={toggleDone}
					onEdit={(task) => setEditing(task)}
					onClearPomodoros={clearCompletedPomodoros}
					onDelete={requestDelete}
				/>

				{tasks.length > 0 && (
					<StatsBar
						completedPomodoros={stats.completed}
						totalPomodoros={stats.totalEstimate}
						estimatedFinish={estimatedFinish}
						focusTime={stats.focusTime}
					/>
				)}
			</Box>

			<ConfirmDeleteDialog
				open={Boolean(pendingDelete)}
				taskName={pendingDelete?.name}
				onConfirm={confirmDelete}
				onCancel={() => setPendingDelete(undefined)}
			/>
		</Box>
	);
}
