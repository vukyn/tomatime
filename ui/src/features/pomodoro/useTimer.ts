"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
	INTERVAL_MINUTES,
	MAX_MINUTES,
	MIN_MINUTES,
	POMODOROS_PER_LONG_BREAK,
} from "@/features/pomodoro/constants";
import type { IntervalKind } from "@/features/pomodoro/types";

const clampMinutes = (value: number) =>
	Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(value)));

export interface UseTimerOptions {
	// Fired when a FOCUS (pomodoro) interval reaches 00:00 naturally.
	// NOT fired when the focus interval is skipped.
	onFocusComplete?: () => void;
}

export interface UseTimerReturn {
	interval: IntervalKind;
	running: boolean;
	remaining: number; // seconds left
	total: number; // seconds in the current interval
	progress: number; // 0..1 elapsed fraction
	minutes: number; // configured pomodoro length (idle-adjustable)
	selectInterval: (kind: IntervalKind) => void;
	start: () => void;
	stop: () => void;
	toggle: () => void;
	skip: () => void;
	incrementMinutes: () => void;
	decrementMinutes: () => void;
	atMinMinutes: boolean;
	atMaxMinutes: boolean;
}

// Drives the countdown + the interval cycle rule. Pure client state.
export function useTimer(options: UseTimerOptions = {}): UseTimerReturn {
	const { onFocusComplete } = options;

	// User-configurable focus length; break lengths use their fixed defaults.
	const [pomodoroMinutes, setPomodoroMinutes] = useState(INTERVAL_MINUTES.pomodoro);
	const [interval, setInterval] = useState<IntervalKind>("pomodoro");
	const [running, setRunning] = useState(false);
	const [remaining, setRemaining] = useState(INTERVAL_MINUTES.pomodoro * 60);
	// Completed focus pomodoros in the current set (drives long-break cadence).
	const [setCount, setSetCount] = useState(0);

	const onFocusCompleteRef = useRef(onFocusComplete);
	useEffect(() => {
		onFocusCompleteRef.current = onFocusComplete;
	}, [onFocusComplete]);

	const minutesFor = useCallback(
		(kind: IntervalKind) =>
			kind === "pomodoro" ? pomodoroMinutes : INTERVAL_MINUTES[kind],
		[pomodoroMinutes]
	);

	const total = minutesFor(interval) * 60;

	// Load a given interval's default duration and reset to idle.
	const loadInterval = useCallback(
		(kind: IntervalKind, nextSetCount?: number) => {
			setInterval(kind);
			setRemaining(minutesFor(kind) * 60);
			setRunning(false);
			if (nextSetCount !== undefined) setSetCount(nextSetCount);
		},
		[minutesFor]
	);

	// Apply the cycle rule when a focus/break interval ends (or is skipped).
	// `countedFocus` = a focus interval finished naturally (count it).
	const advanceCycle = useCallback(
		(countedFocus: boolean) => {
			if (interval === "pomodoro") {
				const newSetCount = countedFocus ? setCount + 1 : setCount;
				const goLong = countedFocus && newSetCount % POMODOROS_PER_LONG_BREAK === 0;
				loadInterval(goLong ? "longBreak" : "shortBreak", newSetCount);
			} else if (interval === "longBreak") {
				// Long break done → fresh set.
				loadInterval("pomodoro", 0);
			} else {
				loadInterval("pomodoro");
			}
		},
		[interval, setCount, loadInterval]
	);

	// Keep the latest interval + advance handler in refs so the once-per-second
	// tick can resolve natural completion without re-subscribing every tick.
	const intervalRef = useRef(interval);
	useEffect(() => {
		intervalRef.current = interval;
	}, [interval]);
	const advanceCycleRef = useRef(advanceCycle);
	useEffect(() => {
		advanceCycleRef.current = advanceCycle;
	}, [advanceCycle]);

	// Tick once per second while running. When the countdown reaches zero, fire
	// completion side-effects and apply the cycle rule from inside the tick (not
	// a separate reactive effect) so we never call setState from an effect body.
	useEffect(() => {
		if (!running) return;
		const handle = window.setInterval(() => {
			setRemaining((prev) => {
				if (prev > 1) return prev - 1;
				const wasFocus = intervalRef.current === "pomodoro";
				if (wasFocus) onFocusCompleteRef.current?.();
				// advanceCycle resets running/remaining/interval for the next phase.
				advanceCycleRef.current(wasFocus);
				return 0;
			});
		}, 1000);
		return () => window.clearInterval(handle);
	}, [running]);

	const selectInterval = useCallback(
		(kind: IntervalKind) => {
			if (kind === interval) return;
			loadInterval(kind);
		},
		[interval, loadInterval]
	);

	const start = useCallback(() => {
		if (remaining <= 0) setRemaining(total);
		setRunning(true);
	}, [remaining, total]);

	const stop = useCallback(() => setRunning(false), []);
	const toggle = useCallback(() => setRunning((prev) => !prev), []);

	// Skip ends the current interval immediately (does NOT count a focus pomodoro).
	const skip = useCallback(() => {
		advanceCycle(false);
	}, [advanceCycle]);

	const incrementMinutes = useCallback(() => {
		if (running || interval !== "pomodoro") return;
		setPomodoroMinutes((prev) => {
			const next = clampMinutes(prev + 1);
			setRemaining(next * 60);
			return next;
		});
	}, [running, interval]);

	const decrementMinutes = useCallback(() => {
		if (running || interval !== "pomodoro") return;
		setPomodoroMinutes((prev) => {
			const next = clampMinutes(prev - 1);
			setRemaining(next * 60);
			return next;
		});
	}, [running, interval]);

	const progress = total > 0 ? (total - remaining) / total : 0;

	return {
		interval,
		running,
		remaining,
		total,
		progress,
		minutes: pomodoroMinutes,
		selectInterval,
		start,
		stop,
		toggle,
		skip,
		incrementMinutes,
		decrementMinutes,
		atMinMinutes: pomodoroMinutes <= MIN_MINUTES,
		atMaxMinutes: pomodoroMinutes >= MAX_MINUTES,
	};
}
